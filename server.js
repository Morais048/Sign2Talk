import express from 'express';
import cors from 'cors';
import fs from 'fs/promises'; 
import path from 'path';
import { getDb } from './db.js';

const app = express();
const PORT = 3000;

const MODEL_FILE = path.join(process.cwd(), 'modelo-ia.json');

// Middleware para permitir que o Front-end no navegador se comunique (CORS)
app.use(cors());
// Middleware para servir arquivos estáticos (onde suas imagens e o HTML estão)
app.use(express.json({ limit: '50mb' })); // Aumentar o limite, pois o modelo pode ser grande
app.use(express.static('treinamento')); // Assumindo que seu HTML está na pasta 'treinamento'



// Rota principal para buscar todo o vocabulário

app.post('/api/modelo', async (req, res) => {
    try {
        const dataset = req.body; // Recebe o JSON do modelo do Front-end
        if (!dataset || Object.keys(dataset).length === 0) {
            return res.status(400).json({ error: 'Nenhum dado de modelo enviado.' });
        }
        
        // Salva o JSON em um arquivo no Back-end
        await fs.writeFile(MODEL_FILE, JSON.stringify(dataset));
        console.log(`💾 Modelo de IA salvo em ${MODEL_FILE}`);
        
        res.json({ message: 'Modelo salvo com sucesso no servidor.' });
    } catch (error) {
        console.error("❌ Erro ao salvar modelo:", error);
        res.status(500).json({ error: 'Erro ao salvar o modelo no servidor.' });
    }
});

// ROTA PARA CARREGAR O MODELO DE IA DO SERVIDOR
app.get('/api/modelo', async (req, res) => {
    try {
        // Verifica se o arquivo existe antes de tentar ler
        await fs.access(MODEL_FILE);
        
        // Lê o conteúdo do arquivo
        const data = await fs.readFile(MODEL_FILE, 'utf8');
        console.log(`📂 Modelo de IA carregado de ${MODEL_FILE}`);
        
        // Envia o JSON do modelo de volta para o Front-end
        res.json(JSON.parse(data));
    } catch (error) {
        // Se o arquivo não existir (primeira vez que o usuário acessa), retorna 404
        if (error.code === 'ENOENT') {
            return res.status(404).json({ error: 'Nenhum modelo salvo encontrado no servidor.' });
        }
        console.error("❌ Erro ao carregar modelo:", error);
        res.status(500).json({ error: 'Erro ao carregar o modelo do servidor.' });
    }
});

app.get('/api/vocabulario', async (req, res) => {
    try {
        const db = await getDb();
        const vocabulario = await db.all("SELECT * FROM VOCABULARIO");
        res.json(vocabulario); // Retorna os dados em formato JSON
    } catch (error) {
        console.error("Erro ao buscar vocabulário:", error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

// Rota para buscar um gesto específico (ideal para a funcionalidade de reconhecimento)
app.get('/api/vocabulario/:palavra', async (req, res) => {
    const palavra = req.params.palavra.toUpperCase(); // Busca a palavra na URL
    try {
        const db = await getDb();
        const gesto = await db.get("SELECT url_imagem FROM VOCABULARIO WHERE palavra = ?", [palavra]);
        
        if (gesto) {
            res.json(gesto); // Retorna a URL da imagem
        } else {
            res.status(404).json({ error: 'Gesto não encontrado.' });
        }
    } catch (error) {
        console.error("Erro ao buscar gesto:", error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

// Inicialização do Servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log("Acesse o Front-end em: http://localhost:3000/treinamento.html");
});