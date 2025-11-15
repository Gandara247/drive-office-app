import { google } from "googleapis";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

async function testAccess() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

    const drive = google.drive({ version: "v3", auth });
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!folderId) {
      console.error("❌ GOOGLE_DRIVE_FOLDER_ID não está configurado no .env");
      return;
    }

    console.log("🔍 Testando acesso à pasta:", folderId);

    // Teste 1: Verificar se consegue acessar a pasta
    try {
      const folderInfo = await drive.files.get({
        fileId: folderId,
        fields: "id, name, mimeType, permissions",
      });
      console.log("✅ Acesso à pasta OK!");
      console.log("📁 Nome da pasta:", folderInfo.data.name);
      console.log("📋 Permissões:", folderInfo.data.permissions?.length || 0);
    } catch (err) {
      console.error("❌ Erro ao acessar pasta:", err.message);
      if (err.code === 404) {
        console.error("   A pasta não foi encontrada. Verifique o ID.");
      } else if (err.code === 403) {
        console.error("   Sem permissão para acessar a pasta.");
        console.error("   Certifique-se de compartilhar a pasta com o email da Service Account.");
      }
      return;
    }

    // Teste 2: Tentar criar um arquivo de teste
    console.log("\n🔍 Testando criação de arquivo...");
    try {
      // Criar arquivo temporário para teste
      const testFileName = `test-${Date.now()}.txt`;
      const testFilePath = `./uploads/${testFileName}`;
      const testContent = "Teste de acesso - " + new Date().toISOString();
      
      // Garantir que o diretório existe
      if (!fs.existsSync("./uploads")) {
        fs.mkdirSync("./uploads", { recursive: true });
      }
      
      fs.writeFileSync(testFilePath, testContent);
      
      const fileMetadata = {
        name: testFileName,
        parents: [folderId],
      };

      const media = {
        mimeType: "text/plain",
        body: fs.createReadStream(testFilePath),
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, name",
      });

      console.log("✅ Upload de teste bem-sucedido!");
      console.log("📄 Arquivo criado:", response.data.name);
      console.log("🆔 ID do arquivo:", response.data.id);

      // Limpar arquivo de teste (local e remoto)
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
      await drive.files.delete({ fileId: response.data.id });
      console.log("🧹 Arquivo de teste removido");

    } catch (err) {
      console.error("❌ Erro ao criar arquivo:", err.message);
      if (err.response && err.response.data) {
        console.error("   Detalhes:", JSON.stringify(err.response.data, null, 2));
      }
      
      if (err.message.includes("storage quota")) {
        console.error("\n⚠️  PROBLEMA: Service Account não tem quota de armazenamento.");
        console.error("   SOLUÇÃO: Compartilhe a pasta com o email da Service Account");
        console.error("   e dê permissão de EDITOR (não apenas visualizador).");
      }
    }

    // Teste 3: Verificar permissões da Service Account
    console.log("\n🔍 Verificando permissões da Service Account...");
    try {
      const credentials = JSON.parse(
        fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8")
      );
      const serviceAccountEmail = credentials.client_email;
      console.log("📧 Email da Service Account:", serviceAccountEmail);
      console.log("   Certifique-se de que este email tem permissão de EDITOR na pasta.");
    } catch (err) {
      console.error("❌ Erro ao ler credenciais:", err.message);
    }

  } catch (error) {
    console.error("❌ Erro geral:", error.message);
    console.error(error);
  }
}

testAccess();
