import './style.css'
import Papa from 'papaparse'

interface EnderecoManual {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  regiao: string;
}

interface ArquivoCSV {
  nome: string;
  ceps: string[];
  colunas: string[];
  dados: any[];
}

let arquivos: ArquivoCSV[] = []
let cepsManuais: EnderecoManual[] = []

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<div class="container">
  <h1 class="title">Rota Inteligente</h1>

  <div class="card">
    <label for="csvInput" class="upload-area">
      <div class="upload-content">📂 Clique ou arraste seus arquivos CSV aqui</div>
    </label>
    <input type="file" id="csvInput" multiple accept=".csv" hidden />
  </div>

  <div class="card">
    <label class="label">Adicionar CEP Manualmente (com Busca)</label>
    <div class="row">
      <input type="text" id="novoCep" placeholder="00000-000" maxlength="9"/>
      <button id="btnBuscar" class="btn-search">🔍 Buscar e Adicionar</button>
    </div>
    
    <div id="tabelaManualContainer" class="preview-container" style="display: none;">
      <h3 style="margin: 15px 0 10px; font-size: 14px; color: #4f8cff;">📍 Endereços Adicionados</h3>
      <table class="preview-table">
        <thead>
          <tr>
            <th>CEP</th>
            <th>Logradouro</th>
            <th>Bairro</th>
            <th>Cidade/UF</th>
            <th>Região</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody id="corpoTabelaManual"></tbody>
      </table>
    </div>
  </div>

  <div id="previewSection" style="display: none;">
    <div class="card">
      <h2>📋 Pré-visualização dos Arquivos</h2>
      <div id="preview"></div>
    </div>
  </div>

  <div class="card">
    <button id="calcularRota" class="primary">🔄 Gerar Rotas</button>
  </div>

  <div id="resultado" class="card" style="display: none;"></div>
</div>
`

// --- MÁSCARA E BUSCA ---
const inputCep = document.getElementById('novoCep') as HTMLInputElement

inputCep.addEventListener('input', (e) => {
  let value = (e.target as HTMLInputElement).value.replace(/\D/g, "")
  if (value.length > 5) value = value.replace(/^(\d{5})(\d)/, "$1-$2")
  inputCep.value = value
})

async function buscarCep(cep: string) {
  const cleanCep = cep.replace(/\D/g, "")
  if (cleanCep.length !== 8) return alert("CEP inválido.")

  const btn = document.getElementById('btnBuscar') as HTMLButtonElement
  btn.disabled = true; btn.innerText = "Pesquisando..."

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
    const data = await response.json()

    if (data.erro) {
      alert("CEP não encontrado.")
    } else {
      cepsManuais.push({
        cep: data.cep,
        logradouro: data.logradouro || 'N/A',
        bairro: data.bairro || 'N/A',
        localidade: data.localidade,
        uf: data.uf,
        regiao: data.regiao || 'N/A'
      })
      renderizarTabelaManual()
      inputCep.value = ""
    }
  } catch (e) {
    alert("Erro ao acessar API.")
  } finally {
    btn.disabled = false; btn.innerText = "🔍 Buscar e Adicionar"
  }
}

// --- RENDERIZAÇÃO ---
function renderizarTabelaManual() {
  const container = document.getElementById('tabelaManualContainer')!
  const corpo = document.getElementById('corpoTabelaManual')!
  container.style.display = cepsManuais.length ? 'block' : 'none'

  corpo.innerHTML = cepsManuais.map((end, index) => `
    <tr>
      <td>${end.cep}</td>
      <td>${end.logradouro}</td>
      <td>${end.bairro}</td>
      <td>${end.localidade}/${end.uf}</td>
      <td><span class="badge-regiao">${end.regiao}</span></td>
      <td><button class="btn-remove" onclick="window.removerCep(${index})">Remover</button></td>
    </tr>
  `).join('')
}

function atualizarPreviewArquivos() {
  const preview = document.getElementById('preview')!
  const previewSection = document.getElementById('previewSection')!

  previewSection.style.display = arquivos.length ? 'block' : 'none'
  preview.innerHTML = ''

  arquivos.forEach((arquivo) => {
    let html = `
      <div style="margin-bottom: 25px;">
        <h3 style="color: #6ea8ff; font-size: 14px;">📄 ${arquivo.nome} (${arquivo.dados.length} registros)</h3>
        <div class="preview-container">
          <table class="preview-table">
            <thead><tr>${arquivo.colunas.map(c => `<th>${c}</th>`).join('')}</tr></thead>
            <tbody>
              ${arquivo.dados.slice(0, 5).map(linha => `
                <tr>${arquivo.colunas.map(col => `<td>${linha[col] ?? ''}</td>`).join('')}</tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `
    preview.innerHTML += html
  })
}

// --- UPLOAD (RESTAURADO) ---
document.getElementById('csvInput')!.addEventListener('change', (event: any) => {
  const files = Array.from(event.target.files as FileList)

  files.forEach((file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        if (!results.data.length) return

        const colunas = Object.keys(results.data[0])
        const colunaCep = colunas.find((col) => col.toLowerCase().includes('cep'))

        if (!colunaCep) {
          alert(`Coluna CEP não encontrada no arquivo ${file.name}`)
          return
        }

        arquivos.push({
          nome: file.name,
          ceps: results.data.map((row: any) => row[colunaCep]?.toString().trim()).filter(Boolean),
          colunas: colunas,
          dados: results.data,
        })

        atualizarPreviewArquivos()
      },
    })
  })
})

// --- ROTAS ---
document.getElementById('calcularRota')!.addEventListener('click', () => {
  const todosCeps = [
    ...arquivos.flatMap(a => a.ceps),
    ...cepsManuais.map(m => m.cep)
  ]

  // const todosCeps = [
  //   ...arquivos.flatMap(a => a.ceps),
  //   ...cepsManuais.sort((a, b) => a.bairro.localeCompare(b.bairro)).map(m => m.cep)
  // ]

  if (todosCeps.length < 2) return alert('Adicione pelo menos 2 CEPs')

  const resultadoDiv = document.getElementById('resultado')!
  resultadoDiv.style.display = 'block'

  const grupos = chunkArray(todosCeps, 25)
  let html = `<h2>🗺️ Links das Rotas</h2><div class="link-rotas">`

  grupos.forEach((grupo, index) => {
    const origem = grupo[0]
    const destino = grupo[grupo.length - 1]
    const waypoints = grupo.slice(1, -1).join('|');

    const googleUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origem)}&destination=${encodeURIComponent(destino)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
    html += `
      <a href="${googleUrl}" target="_blank" style="display:block; margin-bottom:10px; color:#4f8cff; text-decoration:none;">
        🚗 Rota ${index + 1} (${grupo.length} pontos)
      </a>
    `
  })

  resultadoDiv.innerHTML = html + `</div>`
})

function chunkArray(array: string[], size: number) {
  const result = []
  for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size))
  return result
}

// Global para o botão remover
; (window as any).removerCep = (index: number) => {
  cepsManuais.splice(index, 1)
  renderizarTabelaManual()
}

document.getElementById('btnBuscar')!.addEventListener('click', () => buscarCep(inputCep.value))