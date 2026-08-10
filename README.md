# LinkAI

LinkAI é uma plataforma desktop para automação do ERP Lumina e processamento inteligente de notas fiscais. O projeto une backend Python, automação Windows com PyWinAuto, processamento de documentos fiscais, integração com bucket privado do Supabase e uma interface desktop moderna construída com React, TypeScript, Vite e Tauri.

O objetivo do projeto é manter a automação existente do Lumina preservada e transformá-la em uma das funcionalidades de um software maior, modular e preparado para crescimento.

## Status Atual

O projeto contém:

- Automação desktop do Lumina com Python e `pywinauto` usando `backend="uia"`.
- Login automático no Lumina sob demanda.
- Backend Python desacoplado da interface.
- API local em FastAPI para desenvolvimento web.
- Bridge de comandos preparada para Tauri.
- Frontend React + TypeScript + Vite.
- Estrutura Tauri para empacotamento desktop leve.
- Integração com Supabase Storage privado usando `SERVICE_ROLE_KEY`.
- Leitura de PDFs com PyMuPDF e fallback arquitetural para OCR.
- Parser fiscal com Strategy Pattern.
- Escrita de planilhas Excel com Pandas/OpenPyXL.
- Estrutura preparada para logs, screenshots, outputs e cache.

## Tecnologias

### Backend

- Python 3.12+
- PyWinAuto
- FastAPI
- Uvicorn
- Supabase Python SDK
- python-dotenv
- PyMuPDF
- pdfplumber
- pandas
- openpyxl
- rapidfuzz
- tqdm

### Frontend

- React
- TypeScript
- Vite
- Tauri
- Lucide React
- Plus Jakarta Sans

## Estrutura do Projeto

```text
linkai/
|-- backend/
|   |-- api/
|   |   |-- desktop_bridge.py
|   |   `-- server.py
|   |-- automation/
|   |   `-- lumina_service.py
|   |-- core/
|   |-- models/
|   |-- services/
|   |-- storage/
|   `-- utils/
|
|-- frontend/
|   |-- src/
|   |   |-- assets/
|   |   |-- components/
|   |   |-- hooks/
|   |   |-- layouts/
|   |   |-- pages/
|   |   |-- services/
|   |   |-- styles/
|   |   `-- types/
|   |-- src-tauri/
|   |-- package.json
|   `-- vite.config.ts
|
|-- lumina_bot/
|   |-- controls/
|   |-- core/
|   |-- exceptions/
|   |-- logs/
|   |-- models/
|   |-- output/
|   |-- pages/
|   |-- parsers/
|   |-- screenshots/
|   |-- config.py
|   |-- main.py
|   |-- requirements.txt
|   `-- .env.example
|
|-- scripts/
|   `-- dev.py
|-- run-linkai-web.ps1
|-- stop-linkai-web.ps1
`-- README.md
```

## Arquitetura

O LinkAI está dividido em três camadas principais.

### 1. `lumina_bot`

Contém o núcleo original da automação Windows e o processamento fiscal.

Responsabilidades:

- Abrir ou conectar ao Lumina.
- Localizar a janela principal.
- Executar ações de tela com `pywinauto`.
- Representar telas com padrão semelhante ao Page Object Model.
- Efetuar login no Lumina.
- Conectar ao Supabase.
- Listar, baixar e processar documentos fiscais.
- Ler PDFs.
- Detectar tipo de documento fiscal.
- Aplicar parsers.
- Gerar planilhas Excel.
- Registrar logs.

### 2. `backend`

Camada de serviços desacoplada da interface.

Responsabilidades:

- Expor comandos internos para a interface.
- Orquestrar automação Lumina.
- Orquestrar processamento de PDFs.
- Consultar dados da Página Inicial, incluindo obras, mercado e câmbio.
- Listar planilhas geradas.
- Ler logs.
- Testar conexão com Supabase.
- Servir uma API local em ambiente web de desenvolvimento.

### 3. `frontend`

Interface desktop/web do LinkAI.

Responsabilidades:

- Página Inicial.
- Processamento de PDFs.
- Lançamento de notas no Lumina.
- Planilhas geradas.
- Configuração e teste do Supabase.
- Arquivos locais.
- IA.
- Histórico.
- Logs.
- Configurações.

O frontend não contém regras de negócio. Ele chama o backend via bridge local.

## Fluxos Principais

### Lançamento de Notas no Lumina

```text
Usuário clica em "Iniciar lançamento"
↓
Frontend chama o backend
↓
Backend executa LuminaAutomationService
↓
Application abre ou conecta ao Lumina
↓
LoginPage preenche usuário e senha
↓
Botão OK é acionado
```

### Processamento de PDFs

```text
Usuário escolhe origem dos PDFs
↓
Backend lista arquivos
↓
PDFs são lidos
↓
Documento é detectado
↓
Parser adequado é aplicado
↓
Objeto NotaFiscal é criado
↓
ExcelWriter gera planilha
↓
Resultado aparece na interface
```

### Processamento via Supabase

```text
Supabase privado
↓
Listagem recursiva
↓
Download de PDFs
↓
Hash SHA256
↓
Cache local
↓
Leitura e parser
↓
Excel final em output/excel/notas.xlsx
```

## Configuração

Copie o arquivo de exemplo:

```powershell
Copy-Item lumina_bot\.env.example lumina_bot\.env
```

Preencha o arquivo `lumina_bot/.env` localmente.

Exemplo:

```env
# Lumina
LUMINA_USERNAME=
LUMINA_PASSWORD=
LUMINA_EXECUTABLE_PATH=C:\Lumina\Lumina.exe
LUMINA_MAIN_WINDOW_TITLE_RE=.*Lumina.*

# Supabase
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_BUCKET=
SUPABASE_FOLDER=

# Outputs
PDF_DOWNLOAD_PATH=output/pdfs
EXCEL_OUTPUT_PATH=output/excel/notas.xlsx
```

Importante:

- Nunca versionar `lumina_bot/.env`.
- Nunca utilizar `ANON_KEY` para bucket privado.
- Utilizar sempre `SUPABASE_SERVICE_ROLE_KEY`.
- O arquivo `.env.example` é seguro para versionamento porque não contém segredos reais.

## Instalação do Backend

Crie o ambiente virtual dentro de `lumina_bot`:

```powershell
cd lumina_bot
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Volte para a raiz do projeto:

```powershell
cd ..
```

## Instalação do Frontend

```powershell
cd frontend
npm install
cd ..
```

## Executar em Desenvolvimento

Na raiz do projeto:

```powershell
.\run-linkai-web.ps1
```

Esse comando sobe:

- API local em `http://127.0.0.1:8765`
- Frontend web em `http://127.0.0.1:5173`

Acesse:

```text
http://127.0.0.1:5173
```

Para parar:

```powershell
.\stop-linkai-web.ps1
```

## Verificar Ambiente

```powershell
.\lumina_bot\.venv\Scripts\python.exe .\scripts\dev.py --check
```

O comando valida:

- Python do venv.
- `npm`.
- Diretório do frontend.
- Estrutura necessária para ambiente de desenvolvimento.

## Executar Automação Lumina Diretamente

Também é possível executar o fluxo Python diretamente:

```powershell
.\lumina_bot\.venv\Scripts\python.exe -m lumina_bot.main
```

Esse fluxo:

1. Carrega `.env`.
2. Abre ou conecta ao Lumina.
3. Aguarda carregamento.
4. Preenche login.
5. Processa documentos do Supabase.

## Executar Frontend Manualmente

Terminal 1:

```powershell
.\lumina_bot\.venv\Scripts\python.exe -m uvicorn backend.api.server:app --host 127.0.0.1 --port 8765 --reload
```

Terminal 2:

```powershell
cd frontend
npm run dev:web
```

## Build do Frontend

```powershell
cd frontend
npm run build
```

## Tauri

Para rodar com Tauri em desenvolvimento:

```powershell
cd frontend
npm run tauri:dev
```

Para build desktop:

```powershell
cd frontend
npm run tauri build
```

Observação: o empacotamento Tauri pode exigir toolchain Rust configurado no Windows.

## Interface

A interface atual possui:

- Tema escuro inspirado no login oficial do LinkAI.
- Glassmorphism sutil.
- Paleta preta, cinza e rosa.
- Logo oficial da LinkAI.
- Menu lateral com navegação principal.
- Cards de Página Inicial com obras, mercado financeiro e câmbio.
- Telas para PDFs, Lumina, Planilhas, Supabase, Arquivos, IA, Histórico, Configurações e Logs.

## Telas

### Página Inicial

Mostra:

- Principais atualizações de obras da Linka Engenharia.
- Cards com obras concluídas e obras em andamento.
- Cotações de construtoras e incorporadoras listadas na B3.
- Variação percentual dos principais papéis do setor.
- Cotação das principais moedas do mundo contra o real.
- Cotação de BTC e ETH contra o real.
- Atualização em tempo real quando a API externa estiver disponível.

### Processar PDFs

Permite:

- Buscar no bucket Supabase.
- Selecionar pasta local.
- Selecionar arquivos manuais.
- Drag and drop.
- Processar subpastas.
- Gerar Excel.
- Ignorar duplicados.
- Utilizar cache.
- Detectar XML futuramente.
- Escolher modo de Excel.

### Lançar Notas

Executa a automação existente do Lumina somente quando o usuário clicar em iniciar.

### Planilhas

Lista planilhas geradas no output local.

### Supabase

Testa conexão com:

- URL.
- Bucket.
- Pasta.
- Quantidade de itens.

### Logs

Exibe eventos recentes do backend.

## Supabase

O cliente Supabase foi projetado como singleton para evitar múltiplas conexões desnecessárias.

Operações preparadas:

- `listar`
- `listar_recursivamente`
- `download`
- `download_para_disco`
- `download_em_memoria`
- `upload`
- `delete`
- `exists`
- `signed_url`

O bucket é privado e deve utilizar apenas `SUPABASE_SERVICE_ROLE_KEY`.

## Processamento Fiscal

O módulo fiscal foi preparado para:

- NF-e
- NFS-e
- NFC-e
- CT-e
- MDF-e
- Boleto
- Recibo
- Documento desconhecido

O parser usa Strategy Pattern:

```text
ParserManager
↓
DocumentDetector
↓
Parser específico
↓
NotaFiscal
```

Regex é usada apenas como fallback.

## Modelos

Os principais modelos estão em `lumina_bot/models`:

- `NotaFiscal`
- `Emitente`
- `Tomador`
- `Endereco`
- `Tributos`
- `Item`

Todos utilizam `dataclasses` e type hints.

## Excel

A saída padrão é:

```text
lumina_bot/output/excel/notas.xlsx
```

O sistema suporta:

- Uma planilha consolidada.
- Uma aba única com todos os documentos.
- Abas separadas por documento.
- Uma planilha por PDF.

## Logs e Outputs

Pastas preparadas:

```text
lumina_bot/logs/
lumina_bot/screenshots/
lumina_bot/output/pdfs/
lumina_bot/output/excel/
lumina_bot/output/logs/
lumina_bot/output/temp/
```

Arquivos gerados nessas pastas são ignorados pelo Git, exceto `.gitkeep`.

## Segurança

Este projeto foi configurado para não versionar:

- `.env`
- credenciais
- logs
- PDFs baixados
- planilhas geradas
- caches
- builds
- `node_modules`
- `.venv`

Antes de qualquer push:

```powershell
git status --ignored --short
```

Confirme que `lumina_bot/.env` aparece como ignorado.

## Comandos Úteis

```powershell
# Validar ambiente
.\lumina_bot\.venv\Scripts\python.exe .\scripts\dev.py --check

# Rodar API + frontend
.\run-linkai-web.ps1

# Parar portas locais
.\stop-linkai-web.ps1

# Build frontend
cd frontend
npm run build

# Rodar automação Python direta
.\lumina_bot\.venv\Scripts\python.exe -m lumina_bot.main
```

## Git

Repositório remoto:

```text
https://github.com/GIT2LOCK/linkai
```

Branch desta entrega:

```text
GPT-Luna
```

O nome solicitado foi `GPT Luna`, mas Git não aceita espaços em nomes de branch. Por isso a branch foi criada como `GPT-Luna`.

## Roadmap Técnico

Arquitetura preparada para evolução com:

- OCR.
- Tesseract.
- OCRmyPDF.
- Azure OCR.
- Google Vision.
- OpenAI.
- Claude.
- Gemini.
- XML como fonte principal.
- API REST completa.
- Dashboard web.
- Banco PostgreSQL.
- Redis.
- RabbitMQ.
- Workers.
- Processamento paralelo.
- Sincronização incremental.
- Múltiplos ERPs.
- Google Drive.
- OneDrive.
- Dropbox.
- Amazon S3.
- Azure Blob.

## Observações

O backend não conhece a interface.

O frontend não contém regra de negócio.

A automação do Lumina permanece preservada dentro de `lumina_bot`.

O LinkAI pode ser executado como aplicação web local durante desenvolvimento e também está preparado para empacotamento desktop com Tauri.
