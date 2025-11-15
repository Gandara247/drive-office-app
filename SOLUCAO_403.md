# Solução para Erro 403: access_denied

## 🔴 Problema

Você está recebendo o erro:
```
Erro 403: access_denied
Acesso bloqueado: o app não concluiu o processo de verificação do Google.
```

## ✅ Solução: Adicionar Usuários de Teste

Como o app está em modo de teste, você precisa adicionar seu email como usuário de teste.

### Passo a Passo:

1. **Acesse o Google Cloud Console**
   - Vá para: https://console.cloud.google.com/
   - Selecione seu projeto

2. **Configure a Tela de Consentimento OAuth**
   - Vá em **"APIs & Services"** > **"OAuth consent screen"**
   - **IMPORTANTE**: Se você estiver vendo apenas métricas, você precisa **EDITAR** o app primeiro:
     - Procure por um botão **"EDIT APP"** ou **"EDIT"** no topo da página
     - Ou clique no nome do app na parte superior
     - Isso vai abrir o modo de edição

3. **Adicionar Usuários de Teste** ⭐ **IMPORTANTE**
   - **No modo de edição**, role até a seção **"Test users"** (geralmente na última etapa)
   - Se não aparecer, você pode estar na primeira etapa - clique em **"SAVE AND CONTINUE"** até chegar na etapa de "Test users"
   - Clique em **"ADD USERS"** ou **"+ ADD USERS"**
   - Digite seu email do Gmail (o mesmo que você vai usar para autenticar)
   - Clique em **"ADD"** ou **"SAVE"**
   - **IMPORTANTE**: Clique em **"SAVE AND CONTINUE"** ou **"BACK TO DASHBOARD"** para salvar as alterações

4. **Verificar Configuração**
   - Certifique-se de que seu email aparece na lista de "Test users"
   - O status deve mostrar "Testing" (não "In production")

5. **Tentar Novamente**
   - Aguarde alguns minutos para as alterações serem aplicadas
   - Tente acessar `/auth` novamente
   - Faça login com o **mesmo email** que você adicionou como test user

## 📝 Notas Importantes

- **Use o mesmo email**: O email que você adiciona como test user deve ser o mesmo que você usa para fazer login
- **Aguarde alguns minutos**: As alterações podem levar alguns minutos para serem aplicadas
- **Limpe o cache**: Se ainda não funcionar, limpe o cache do navegador ou use uma janela anônima

## 🔄 Alternativa: Publicar o App (Não Recomendado para Testes)

Se você quiser que qualquer pessoa use o app sem ser test user, você precisaria:
1. Completar o processo de verificação do Google (pode levar semanas)
2. Fornecer documentação de privacidade
3. Passar por revisão do Google

**Para desenvolvimento e testes, usar test users é a melhor opção.**

## ✅ Verificação

Após adicionar seu email como test user:
1. Acesse: `http://localhost:3000/auth`
2. Copie a `authUrl` e abra no navegador
3. Faça login com o email que você adicionou como test user
4. Você deve conseguir autorizar o app sem erro 403

