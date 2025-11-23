import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const DB_PATH = './banco.db';
let dbInstance = null;

async function inicializarBanco() {
    if (dbInstance) return dbInstance;
    
    console.log("Iniciando conexão com o banco de dados...");
    
    try {
        dbInstance = await open({
            filename: DB_PATH,
            driver: sqlite3.Database,
        });

        // Tabela para armazenar as palavras e a URL da imagem/vídeo do gesto
        await dbInstance.run(`
            CREATE TABLE IF NOT EXISTS VOCABULARIO (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                palavra TEXT NOT NULL UNIQUE,
                categoria TEXT NOT NULL,
                url_imagem TEXT NOT NULL
            )
        `);
        console.log("✅ Tabela 'VOCABULARIO' verificada/criada.");

        // Inserir dados de exemplo se estiver vazio
        const count = await dbInstance.get("SELECT COUNT(*) as total FROM VOCABULARIO");
        if (count.total === 0) {
            console.log("Inserindo dados do Alfabeto e exemplos...");
            const alfabetoEbasicos = [
            // ALFABETO (Para Treinamento de Letras)
            { palavra: 'A', categoria: 'Alfabeto', url_imagem: '/gestos/A.gif' },
            { palavra: 'B', categoria: 'Alfabeto', url_imagem: '/gestos/B.gif' },
            { palavra: 'C', categoria: 'Alfabeto', url_imagem: '/gestos/C.gif' },
            { palavra: 'D', categoria: 'Alfabeto', url_imagem: '/gestos/D.gif' },
            { palavra: 'E', categoria: 'Alfabeto', url_imagem: '/gestos/E.gif' },
            { palavra: 'F', categoria: 'Alfabeto', url_imagem: '/gestos/F.gif' },
            { palavra: 'G', categoria: 'Alfabeto', url_imagem: '/gestos/G.gif' },
            { palavra: 'H', categoria: 'Alfabeto', url_imagem: '/gestos/H.gif' },
            { palavra: 'I', categoria: 'Alfabeto', url_imagem: '/gestos/I.gif' },
            { palavra: 'J', categoria: 'Alfabeto', url_imagem: '/gestos/J.gif' },
            { palavra: 'K', categoria: 'Alfabeto', url_imagem: '/gestos/K.gif' },
            { palavra: 'L', categoria: 'Alfabeto', url_imagem: '/gestos/L.gif' },
            { palavra: 'M', categoria: 'Alfabeto', url_imagem: '/gestos/M.gif' },
            { palavra: 'N', categoria: 'Alfabeto', url_imagem: '/gestos/N.gif' },
            { palavra: 'O', categoria: 'Alfabeto', url_imagem: '/gestos/O.gif' },
            { palavra: 'P', categoria: 'Alfabeto', url_imagem: '/gestos/P.gif' },
            { palavra: 'Q', categoria: 'Alfabeto', url_imagem: '/gestos/Q.gif' },
            { palavra: 'R', categoria: 'Alfabeto', url_imagem: '/gestos/R.gif' },
            { palavra: 'S', categoria: 'Alfabeto', url_imagem: '/gestos/S.gif' },
            { palavra: 'T', categoria: 'Alfabeto', url_imagem: '/gestos/T.gif' },
            { palavra: 'U', categoria: 'Alfabeto', url_imagem: '/gestos/U.gif' },
            { palavra: 'V', categoria: 'Alfabeto', url_imagem: '/gestos/V.gif' },
            { palavra: 'W', categoria: 'Alfabeto', url_imagem: '/gestos/W.gif' },
            { palavra: 'X', categoria: 'Alfabeto', url_imagem: '/gestos/X.gif' },
            { palavra: 'Y', categoria: 'Alfabeto', url_imagem: '/gestos/Y.gif' },
            { palavra: 'Z', categoria: 'Alfabeto', url_imagem: '/gestos/Z.gif' },

            // PALAVRAS BÁSICAS 
            { palavra: 'OLA', categoria: 'Saudacao', url_imagem: '/gestos/ola.gif' },
            { palavra: 'BEM', categoria: 'Estado', url_imagem: '/gestos/bem.gif' },
            { palavra: 'MAL', categoria: 'Estado', url_imagem: '/gestos/mal.gif' }
            ]
        }
        
        return dbInstance;
    } catch (error) {
        console.error("❌ Erro ao inicializar o banco de dados:", error);
        throw error;
    }
}

// Função que será usada pelo servidor (server.js)
export async function getDb() {
    return inicializarBanco();
}