# Drive Office App

API para upload, listagem e download de arquivos no Google Drive usando Service Account.

## 🚀 Configuração Inicial

### 1. Credenciais do Google Cloud

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto ou selecione um existente
3. Ative a API do Google Drive
4. Crie uma Service Account:
   - Vá em "IAM & Admin" > "Service Accounts"
   - Clique em "Create Service Account"
   - Preencha os dados e crie
5. Baixe a chave JSON:
   - Clique na Service Account criada
   - Vá em "Keys" > "Add Key" > "Create new key"
   - Escolha JSON e baixe
6. Salve o arquivo em `credentials/credentials.json`

### 2. ⚠️ IMPORTANTE: Configurar OAuth Delegation

**Service Accounts não possuem quota de armazenamento próprio e não podem criar arquivos em pastas compartilhadas de contas pessoais!**

**Solução: OAuth Delegation** - A Service Account atua em nome de um usuário específico.

#### Opção A: Google Workspace (Recomendado)

Se você tem Google Workspace:

1. No Google Workspace Admin Console:
   - Vá em "Segurança" > "Controles de acesso à API" > "Gerenciamento de domínio para APIs"
   - Ative "Domain-wide delegation"
   - Anote o Client ID da sua Service Account (encontre em `credentials/credentials.json` no campo `client_id`)

2. Configure o OAuth delegation:
   - No Google Workspace Admin, vá em "Segurança" > "Controles de acesso à API"
   - Clique em "Gerenciar delegação de domínio"
   - Adicione o Client ID da Service Account
   - Adicione o escopo: `https://www.googleapis.com/auth/drive`
   - Salve

3. Configure no `.env`:
   ```
   GOOGLE_USER_EMAIL=seu-email@seudominio.com
   GOOGLE_DRIVE_FOLDER_ID=ID_DA_PASTA
   ```

#### Opção B: Conta Pessoal (Sem Google Workspace) ✅ IMPLEMENTADO

**Use OAuth 2.0** - Autenticação direta com sua conta Google pessoal.

📖 **Veja o guia completo em:** [SETUP_OAUTH2.md](./SETUP_OAUTH2.md)

**Resumo rápido:**
1. Crie credenciais OAuth 2.0 no Google Cloud Console (não Service Account)
2. Configure no `.env`:
   ```env
   GOOGLE_CLIENT_ID=seu-client-id
   GOOGLE_CLIENT_SECRET=seu-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
   GOOGLE_DRIVE_FOLDER_ID=ID_DA_PASTA
   ```
3. Acesse `http://localhost:3000/auth` e autorize
4. Pronto! O token será salvo automaticamente

### 3. Variáveis de Ambiente

Configure o arquivo `.env`:

**Para Google Workspace (OAuth Delegation):**
```env
PORT=3000
GOOGLE_APPLICATION_CREDENTIALS=./credentials/credentials.json
GOOGLE_DRIVE_FOLDER_ID=seu-folder-id-aqui
GOOGLE_USER_EMAIL=seu-email@seudominio.com
```

**Para Conta Pessoal (OAuth 2.0):**
```env
PORT=3000
GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
GOOGLE_DRIVE_FOLDER_ID=seu-folder-id-aqui
```

**Nota:** Veja [SETUP_OAUTH2.md](./SETUP_OAUTH2.md) para instruções detalhadas de OAuth 2.0.

## 📦 Instalação

```bash
npm install
```

## 🏃 Executar

```bash
# Desenvolvimento (com nodemon)
npm run dev

# Produção
node server.js
```

O servidor estará rodando em `http://localhost:3000`

## 🎨 Interface Web

- Acesse `http://localhost:3000/` para usar o painel gráfico
- Recursos disponíveis:
  - Navegação entre subpastas (com breadcrumbs)
  - Criação **e renomeação** de subpastas
  - Upload, download e remoção de arquivos
  - Exibição de quem criou/modificou cada pasta/arquivo
  - Atualização automática (sem recarregar a página) e sincronização em tempo real dos itens
  - Indicadores de progresso para uploads e downloads, com lista de transferências
- O frontend consome os mesmos endpoints REST descritos abaixo

## 📡 Endpoints

> A rota `/` serve o painel web. Use os endpoints abaixo para automações.

### POST `/upload`
Faz upload de um arquivo para o Google Drive (pasta configurada ou informada).

**Body:** form-data com
- `file`: arquivo (campo obrigatório, qualquer nome)
- `folderId` (opcional): pasta destino. Se não informado, usa `GOOGLE_DRIVE_FOLDER_ID`.

**Resposta de sucesso:**
```json
{
  "success": true,
  "file": {
    "id": "1ABC123...",
    "name": "arquivo.pdf"
  }
}
```

### GET `/files`
Lista os arquivos da pasta informada.

**Query params:**
- `folderId` (opcional) — ID da pasta. Se omitido, usa a pasta principal.

**Resposta:**
```json
{
  "folderId": "1ABC123...",
  "files": [
    {
      "id": "1DEF456...",
      "name": "arquivo.pdf",
      "mimeType": "application/pdf"
    }
  ]
}
```

### DELETE `/files/:id`
Remove um arquivo pelo ID.

```json
{ "success": true }
```

### GET `/folders`
Lista as subpastas da pasta informada (padrão: pasta principal).

**Query params:**
- `parentId` (opcional) — pasta pai

```json
{
  "currentFolder": { "id": "1ABC123...", "name": "Pasta principal" },
  "folders": [
    { "id": "1XYZ", "name": "Documentos" }
  ],
  "rootFolderId": "1ABC123..."
}
```

### POST `/folders`
Cria uma nova subpasta.

**Body (JSON):**
```json
{ "name": "Relatórios", "parentId": "1ABC123..." }
```

### PATCH `/folders/:id`
Renomeia uma subpasta existente.

**Body (JSON):**
```json
{ "name": "Novo nome" }
```

```json
{
  "folder": {
    "id": "1NEW",
    "name": "Novo nome"
  }
}
```

```json
{
  "folder": {
    "id": "1NEW",
    "name": "Relatórios"
  }
}
```

### GET `/download/:id`
Faz download de um arquivo pelo ID.

**Parâmetros:**
- `id`: ID do arquivo no Google Drive

### GET `/auth`
Inicia o fluxo de autenticação OAuth 2.0 (para contas pessoais).

**Resposta:**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "message": "Acesse a URL para autorizar"
}
```

### GET `/oauth2callback`
Callback do OAuth 2.0. Esta rota é chamada automaticamente após a autorização.

### GET `/service-account-email`
Mostra o e-mail da Service Account configurada.

## 🔧 Solução de Problemas

### Erro: "Service Accounts do not have storage quota"

**Solução:** Siga os passos na seção "Compartilhar Pasta do Google Drive" acima.

### Erro: "Unexpected field"

**Solução:** Use form-data com qualquer nome de campo para o arquivo.

### Erro de autenticação

**Solução:** 
- Verifique se o arquivo `credentials/credentials.json` existe e está correto
- Verifique se a Service Account tem permissão na pasta compartilhada
- Verifique se a API do Google Drive está ativada no projeto

## 📝 Notas

- Os arquivos são temporariamente salvos em `uploads/` durante o upload e depois removidos
- A Service Account precisa ter permissão de "Editor" na pasta compartilhada (caso esteja usando esse modo)
- Para contas pessoais, siga [SETUP_OAUTH2.md](./SETUP_OAUTH2.md)
- Para erros `access_denied`, consulte [SOLUCAO_403.md](./SOLUCAO_403.md) e [ADICIONAR_TEST_USERS.md](./ADICIONAR_TEST_USERS.md)

