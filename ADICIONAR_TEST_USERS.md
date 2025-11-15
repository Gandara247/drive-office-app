# Como Adicionar Test Users no Google Cloud Console

## 🔍 Problema: Não vejo a opção de adicionar test users

Se você está vendo apenas métricas na tela de consentimento OAuth, siga estes passos:

## 📋 Passo a Passo Detalhado

### Opção 1: Editar o App (Recomendado)

1. **Acesse o Google Cloud Console**
   - https://console.cloud.google.com/
   - Selecione seu projeto

2. **Vá para OAuth Consent Screen**
   - Menu lateral: **"APIs & Services"** > **"OAuth consent screen"**

3. **Entrar no Modo de Edição**
   - Procure por um dos seguintes:
     - Botão **"EDIT APP"** no topo da página
     - Botão **"EDIT"** ao lado do nome do app
     - Ou clique diretamente no **nome do app** na parte superior
   - Isso vai abrir o formulário de edição

4. **Navegar até Test Users**
   - Se você estiver na primeira etapa, clique em **"SAVE AND CONTINUE"**
   - Continue clicando até chegar na etapa **"Test users"** (geralmente é a última etapa)
   - Ou role a página até encontrar a seção **"Test users"**

5. **Adicionar seu Email**
   - Na seção "Test users", você verá:
     - Uma lista de emails (se já houver algum)
     - Um botão **"ADD USERS"** ou **"+ ADD USERS"**
   - Clique em **"ADD USERS"**
   - Digite seu email do Gmail
   - Clique em **"ADD"** ou **"SAVE"**

6. **Salvar as Alterações**
   - Clique em **"SAVE AND CONTINUE"** ou **"BACK TO DASHBOARD"**
   - **IMPORTANTE**: Não esqueça de salvar!

### Opção 2: Via URL Direta

Se a opção 1 não funcionar, tente acessar diretamente:

1. Vá para: https://console.cloud.google.com/apis/credentials/consent
2. Selecione seu projeto
3. Clique em **"EDIT APP"** ou **"EDIT"**
4. Siga os passos acima a partir do passo 4

### Opção 3: Verificar Status do App

1. Na página "OAuth consent screen", verifique o **"Publishing status"**
2. Se estiver como **"In production"**, você precisa:
   - Clicar em **"PUBLISH APP"** e depois **"CONFIRM"** (isso pode levar a verificação)
   - **OU** voltar para modo de teste clicando em **"BACK TO TESTING"**

3. Se estiver como **"Testing"**, você deve conseguir adicionar test users

## ✅ Verificação

Após adicionar seu email como test user:

1. Verifique se seu email aparece na lista de "Test users"
2. O status deve mostrar **"Testing"** (não "In production")
3. Aguarde alguns minutos para as alterações serem aplicadas
4. Tente autenticar novamente em `http://localhost:3000/auth`

## 🆘 Se Ainda Não Funcionar

1. **Limpe o cache do navegador** e tente novamente
2. **Use uma janela anônima/privada** do navegador
3. **Verifique se você tem permissões** de Owner ou Editor no projeto
4. **Tente criar um novo projeto** e configurar OAuth do zero

## 📝 Notas

- O modo de **"Testing"** permite até 100 test users
- Cada test user precisa ser adicionado manualmente
- As alterações podem levar alguns minutos para serem aplicadas
- Use o **mesmo email** que você adicionou como test user para fazer login

