# Configuração OAuth 2.0 para Contas Pessoais

Como você não tem Google Workspace, você precisa usar OAuth 2.0 (não Service Account) para fazer upload de arquivos no Google Drive.

## 📋 Passo a Passo

### 1. Criar Credenciais OAuth 2.0 no Google Cloud Console

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Selecione seu projeto (ou crie um novo)
3. Vá em **"APIs & Services"** > **"Credentials"**
4. Clique em **"Create Credentials"** > **"OAuth client ID"**
5. Se for a primeira vez, configure a tela de consentimento:
   - Escolha **"External"** (para contas pessoais)
   - Preencha as informações obrigatórias:
     - **App name**: Nome do seu app
     - **User support email**: Seu email
     - **Developer contact information**: Seu email
   - **IMPORTANTE**: Na seção **"Test users"**, adicione seu email do Gmail como usuário de teste
     - Clique em **"ADD USERS"**
     - Digite seu email do Gmail
     - Clique em **"ADD"**
     - Salve as alterações
6. Configure o OAuth Client:
   - **Application type**: Escolha **"Web application"**
   - **Name**: Dê um nome (ex: "Drive Office App")
   - **Authorized redirect URIs**: Adicione:
     ```
     http://localhost:3000/oauth2callback
     ```
     (Ajuste a porta se necessário)
7. Clique em **"Create"**
8. **IMPORTANTE**: Copie o **Client ID** e **Client Secret** que aparecerão

### 2. Configurar Variáveis de Ambiente

Edite o arquivo `.env` e adicione:

```env
PORT=3000
GOOGLE_CLIENT_ID=seu-client-id-aqui.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-client-secret-aqui
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
GOOGLE_DRIVE_FOLDER_ID=ID_DA_PASTA_DO_SEU_DRIVE
```

**Como obter o ID da pasta:**
1. Abra a pasta no Google Drive
2. A URL será: `https://drive.google.com/drive/folders/ABC123XYZ`
3. Copie o ID (parte após `/folders/`)

### 3. Autenticar pela Primeira Vez

1. Inicie o servidor:
   ```bash
   node server.js
   ```

2. Acesse no navegador:
   ```
   http://localhost:3000/auth
   ```

3. Você receberá uma resposta JSON com uma URL. Copie a `authUrl` e abra no navegador.

4. Faça login com sua conta Google e autorize o acesso.

5. Você será redirecionado para `http://localhost:3000/oauth2callback` e verá uma mensagem de sucesso.

6. Um arquivo `token.json` será criado automaticamente. Este arquivo contém suas credenciais de acesso.

### 4. Pronto! 🎉

Agora você pode usar a API normalmente:

- **POST** `/upload` - Fazer upload de arquivos
- **GET** `/files` - Listar arquivos
- **GET** `/download/:id` - Download de arquivos

## 🔄 Renovar Autenticação

O token será renovado automaticamente quando expirar (usando o refresh token).

Se precisar reautenticar:
1. Delete o arquivo `token.json`
2. Acesse `/auth` novamente e siga o processo

## ⚠️ Importante

- O arquivo `token.json` contém suas credenciais de acesso. **NÃO compartilhe este arquivo!**
- Adicione `token.json` ao `.gitignore` para não subir para o Git
- O token tem validade limitada, mas será renovado automaticamente

