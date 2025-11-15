import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import { google } from "googleapis";
import dotenv from "dotenv";
import path from "path";
import session from "express-session";

dotenv.config();

// Debug: Verificar se as variáveis OAuth estão carregadas
console.log("🔍 Verificando variáveis OAuth:");
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "✅ Configurado" : "❌ Não configurado");
console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "✅ Configurado" : "❌ Não configurado");
console.log("GOOGLE_REDIRECT_URI:", process.env.GOOGLE_REDIRECT_URI || "Usando padrão");

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret";
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
if (!ROOT_FOLDER_ID) {
  console.warn("⚠️  GOOGLE_DRIVE_FOLDER_ID não está configurado. Defina no arquivo .env.");
}

const allowedUsers = (process.env.ALLOWED_USERS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

if (allowedUsers.length) {
  console.log("✅ Lista de usuários autorizados carregada:", allowedUsers);
} else {
  console.log("ℹ️  Nenhum usuário definido em ALLOWED_USERS. Qualquer conta aprovada poderá acessar.");
}

const OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "openid"
];

const isUserAllowed = (email) => {
  if (!email) return false;
  if (!allowedUsers.length) return true;
  return allowedUsers.includes(email.toLowerCase());
};

const requireAuth = (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  return next();
};

if (!process.env.SESSION_SECRET) {
  console.warn("⚠️  SESSION_SECRET não definido. Usando valor padrão (somente para desenvolvimento).");
}

const app = express();

// Necessário em plataformas como Render/Heroku para que o Express reconheça HTTPS
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  })
);
app.use(express.static(path.join(process.cwd(), "public")));

// Rota principal: serve o frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

app.get("/me", (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  res.json({ user: req.session.user });
});

app.post("/logout", (req, res) => {
  if (!req.session) {
    return res.json({ success: true });
  }
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

// Rota para obter o email da Service Account (ajuda na configuração)
app.get("/service-account-email", requireAuth, (req, res) => {
  try {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./credentials/credentials.json";
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
    res.json({ 
      serviceAccountEmail: credentials.client_email,
      message: "Compartilhe uma pasta do Google Drive com este email e dê permissão de Editor"
    });
  } catch (error) {
    res.status(500).json({ 
      error: "Não foi possível ler as credenciais",
      message: error.message 
    });
  }
});

// Configuração OAuth 2.0 para contas pessoais
let oauth2Client = null;
const TOKEN_PATH = path.join(process.cwd(), "token.json");

const ensureRootFolder = () => {
  if (!ROOT_FOLDER_ID) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID não está configurado no .env.");
  }
  return ROOT_FOLDER_ID;
};

// Função para inicializar OAuth 2.0
const initOAuth2 = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.log("⚠️  OAuth 2.0 não inicializado - variáveis faltando:");
    console.log("   GOOGLE_CLIENT_ID:", clientId ? "✅" : "❌");
    console.log("   GOOGLE_CLIENT_SECRET:", clientSecret ? "✅" : "❌");
    return null;
  }
  
  if (!oauth2Client) {
    oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      process.env.GOOGLE_REDIRECT_URI || `http://localhost:${process.env.PORT || 3000}/oauth2callback`
    );
    
    console.log("✅ OAuth 2.0 inicializado com sucesso");
    
    // Carregar token salvo se existir
    if (fs.existsSync(TOKEN_PATH)) {
      try {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
        oauth2Client.setCredentials(token);
        console.log("✅ Token OAuth carregado do arquivo");
      } catch (error) {
        console.log("⚠️  Erro ao carregar token:", error.message);
      }
    }
  }
  return oauth2Client;
};

// Rota para iniciar autenticação OAuth
app.get("/auth", (req, res) => {
  const oauth2 = initOAuth2();
  if (!oauth2) {
    return res.status(400).json({
      error: "OAuth 2.0 não configurado. Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env"
    });
  }

  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: OAUTH_SCOPES,
    prompt: "consent",
    include_granted_scopes: true
  });

  res.json({ authUrl, message: "Acesse a URL para autorizar" });
});

// Rota de callback OAuth
app.get("/oauth2callback", async (req, res) => {
  const oauth2 = initOAuth2();
  if (!oauth2) {
    return res.status(400).send("OAuth 2.0 não configurado");
  }

  const { code } = req.query;
  if (!code) {
    return res.status(400).send("Código de autorização não fornecido");
  }

  try {
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    const oauth2Api = google.oauth2("v2");
    const { data: profile } = await oauth2Api.userinfo.get({ auth: oauth2 });

    if (!profile?.email) {
      return res.status(403).send("Não foi possível obter o email do usuário autenticado.");
    }

    if (!isUserAllowed(profile.email)) {
      console.warn(`🚫 Tentativa de acesso não autorizada: ${profile.email}`);
      return res
        .status(403)
        .send("Usuário não autorizado. Verifique se o email está cadastrado em ALLOWED_USERS.");
    }
    
    // Salvar token
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    driveInstance = null; // reinicia instância para usar o novo token

    req.session.user = {
      email: profile.email,
      name: profile.name || profile.given_name || profile.email,
      picture: profile.picture || null
    };

    req.session.save(() => {
      res.redirect("/?login=success");
    });
  } catch (error) {
    console.error("Erro ao obter token:", error);
    res.status(500).send("Erro ao concluir a autenticação. Consulte o console do servidor.");
  }
});

// Configuração do multer (upload temporário)
const upload = multer({ dest: "uploads/" });

// Função para obter instância do Drive (lazy initialization)
let driveInstance = null;
const getDrive = async () => {
  if (!driveInstance) {
    try {
      let auth;
      
      // Prioridade 1: OAuth 2.0 (para contas pessoais)
      const oauth2 = initOAuth2();
      if (oauth2 && fs.existsSync(TOKEN_PATH)) {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
        oauth2.setCredentials(token);
        
        // Verificar se o token expirou e renovar se necessário
        if (token.expiry_date && Date.now() >= token.expiry_date) {
          if (token.refresh_token) {
            await oauth2.refreshAccessToken();
            const newToken = oauth2.credentials;
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(newToken));
          } else {
            throw new Error("Token expirado e sem refresh token. Reautentique em /auth");
          }
        }
        
        auth = oauth2;
        console.log("Usando OAuth 2.0 (conta pessoal)");
      }
      // Prioridade 2: OAuth delegation (Google Workspace)
      else if (process.env.GOOGLE_USER_EMAIL && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        const credentials = JSON.parse(
          fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8")
        );
        
        const jwtClient = new google.auth.JWT(
          credentials.client_email,
          null,
          credentials.private_key,
          ["https://www.googleapis.com/auth/drive"],
          process.env.GOOGLE_USER_EMAIL
        );
        
        auth = jwtClient;
        console.log(`Usando OAuth delegation para: ${process.env.GOOGLE_USER_EMAIL}`);
      }
      // Prioridade 3: Service Account (sem delegation - não funciona para contas pessoais)
      else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        auth = new google.auth.GoogleAuth({
          keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
          scopes: ["https://www.googleapis.com/auth/drive"],
        });
        console.log("Usando autenticação de Service Account (sem delegation)");
        console.log("⚠️  AVISO: Service Accounts não funcionam com contas pessoais. Use OAuth 2.0.");
      } else {
        throw new Error("Nenhuma autenticação configurada. Configure OAuth 2.0 ou Service Account.");
      }
      
      driveInstance = google.drive({ version: "v3", auth });
    } catch (error) {
      console.error("Erro ao inicializar autenticação do Google:", error.message);
      throw error;
    }
  }
  return driveInstance;
};

// Rota para upload de arquivo
app.post("/upload", requireAuth, upload.any(), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Nenhum arquivo enviado. Envie o arquivo usando form-data com qualquer nome de campo." 
      });
    }

    // Pega o primeiro arquivo enviado
    const file = req.files[0];
    
    const drive = await getDrive();
    const targetFolderId = req.body.folderId || ensureRootFolder();
    const fileMetadata = {
      name: file.originalname,
      parents: [targetFolderId],
    };

    const media = {
      mimeType: file.mimetype || "application/octet-stream",
      body: fs.createReadStream(file.path),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields:
        "id, name, mimeType, size, webViewLink, owners(displayName,emailAddress), lastModifyingUser(displayName,emailAddress), createdTime, modifiedTime",
    });

    // Remove o arquivo local temporário
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    res.json({ success: true, file: response.data });
  } catch (error) {
    console.error("Erro no upload - Detalhes completos:", error);
    console.error("Erro completo:", JSON.stringify(error, null, 2));
    
    // Limpa arquivos temporários em caso de erro
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    
    // Tratamento específico para erro de quota de Service Account
    let errorMessage = error.message || "Erro ao fazer upload do arquivo";
    let statusCode = 500;
    let errorDetails = {};
    
    // Captura detalhes do erro do Google
    if (error.response && error.response.data) {
      errorDetails = error.response.data;
      errorMessage = error.response.data.error?.message || error.message;
    }
    
    // Verifica diferentes tipos de erro relacionados a quota/permissão
    const errorStr = JSON.stringify(error).toLowerCase();
    const errorMsgLower = errorMessage.toLowerCase();
    
    if (errorMsgLower.includes("service accounts do not have storage quota") ||
        errorMsgLower.includes("storage quota") ||
        errorStr.includes("storage quota")) {
      statusCode = 400;
      errorMessage = `Service Account não possui quota de armazenamento.
      
SOLUÇÃO: Compartilhe uma pasta do seu Google Drive pessoal com o email da Service Account.

Passos:
1. Acesse: http://localhost:3000/service-account-email para ver o email
2. No Google Drive, abra a pasta com ID: ${process.env.GOOGLE_DRIVE_FOLDER_ID || 'NÃO CONFIGURADO'}
3. Clique com botão direito na pasta > Compartilhar
4. Cole o email da Service Account
5. Dê permissão de "Editor" (não apenas "Visualizador")
6. Certifique-se de que a opção "Notificar pessoas" está desmarcada
7. Clique em "Enviar"

IMPORTANTE: A Service Account precisa ter permissão de ESCRITA (Editor), não apenas leitura.

Erro detalhado: ${errorMessage}`;
    }
    
    res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      details: errorDetails,
      folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || "Não configurado"
    });
  }
});

// Rota para listar subpastas
app.get("/folders", requireAuth, async (req, res) => {
  try {
    const drive = await getDrive();
    const parentId = req.query.parentId || ensureRootFolder();

    const [foldersResponse, parentResponse] = await Promise.all([
      drive.files.list({
        q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields:
          "files(id, name, parents, createdTime, modifiedTime, webViewLink, owners(displayName,emailAddress), lastModifyingUser(displayName,emailAddress))",
        orderBy: "name_natural"
      }),
      drive.files.get({
        fileId: parentId,
        fields:
          "id, name, parents, webViewLink, owners(displayName,emailAddress), lastModifyingUser(displayName,emailAddress)"
      }).catch(() => ({ data: { id: parentId, name: parentId } }))
    ]);

    res.json({
      currentFolder: parentResponse.data,
      folders: foldersResponse.data.files,
      rootFolderId: ensureRootFolder()
    });
  } catch (error) {
    console.error("Erro ao listar pastas:", error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para criar subpasta
app.post("/folders", requireAuth, async (req, res) => {
  try {
    const { name, parentId } = req.body;
    if (!name) {
      return res.status(400).json({ error: "O nome da pasta é obrigatório." });
    }

    const drive = await getDrive();
    const response = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId || ensureRootFolder()]
      },
      fields:
        "id, name, parents, webViewLink, createdTime, owners(displayName,emailAddress), lastModifyingUser(displayName,emailAddress)"
    });

    res.status(201).json({ folder: response.data });
  } catch (error) {
    console.error("Erro ao criar pasta:", error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para renomear pasta
app.patch("/folders/:id", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "O novo nome é obrigatório." });
    }

    const drive = await getDrive();
    const response = await drive.files.update({
      fileId: req.params.id,
      requestBody: { name },
      fields: "id, name, parents, webViewLink, modifiedTime"
    });

    res.json({ folder: response.data });
  } catch (error) {
    console.error("Erro ao renomear pasta:", error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para remover arquivo
app.delete("/files/:id", requireAuth, async (req, res) => {
  try {
    const drive = await getDrive();
    await drive.files.delete({ fileId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao remover arquivo:", error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para listar arquivos (suporta filtro por pasta)
app.get("/files", requireAuth, async (req, res) => {
  try {
    const drive = await getDrive();
    const folderId = req.query.folderId || ensureRootFolder();
    const queryParts = [
      `'${folderId}' in parents`,
      "trashed = false",
      "mimeType != 'application/vnd.google-apps.folder'"
    ];

    const response = await drive.files.list({
      q: queryParts.join(" and "),
      fields:
        "files(id, name, mimeType, size, webViewLink, createdTime, modifiedTime, owners(displayName,emailAddress), lastModifyingUser(displayName,emailAddress))",
      orderBy: "name_natural"
    });
    res.json({ folderId, files: response.data.files });
  } catch (error) {
    console.error("Erro ao listar arquivos:", error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para download
app.get("/download/:id", requireAuth, async (req, res) => {
  try {
    const drive = await getDrive();
    const fileId = req.params.id;
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileId}"`);
    response.data.pipe(res);
  } catch (error) {
    console.error("Erro no download:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
