// ====================================================================
// app.js - Lógica Principal e Integração com o Banco de Dados (BD)
// ====================================================================

// ========== VARIÁVEIS GLOBAIS ==========
// 🚨 NOVO: URL BASE DA API (RENDER)
const RENDER_API_URL = 'https://sign2talk.onrender.com';

let modeloMobileNet;
let classificador;
let webcam;
let imagesToTrain = []; 
let reconhecendo = false;
let animationFrameId = null; 

// ========== INICIALIZAÇÃO E CARREGAMENTO DE IA ==========
async function inicializarSistema() {
    try {
        atualizarStatus("🔄 Carregando modelo de IA (MobileNet)...");
        modeloMobileNet = await mobilenet.load();
        classificador = knnClassifier.create();
        
        // NOVO: Adiciona a chamada para criar os botões A-Z
        criarBotoesLetras();
        
        // 🚨 CORREÇÃO DE ID: Removido o 'document.getElementById('loadBtn').disabled = false'
        // A função habilitarControlesWebcam() fará isso após a câmera iniciar, e a criação
        // de botões no HTML já resolve o erro anterior.
        
        atualizarStatus("✅ IA carregada! Clique em 'Iniciar'.");
    } catch (error) {
        console.error("Erro na inicialização:", error);
        atualizarStatus("❌ Erro ao carregar IA: " + error.message);
    }
}

// NOVO: Função para criar os botões A-Z (removida do seu HTML anterior)
function criarBotoesLetras() {
    const grid = document.getElementById('lettersGrid');
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let letra of letras) {
        const btn = document.createElement('button');
        btn.className = 'btn-letter';
        btn.id = 'train' + letra;
        btn.textContent = letra;
        btn.onclick = () => trainLetter(letra);
        btn.disabled = true;
        if (grid) grid.appendChild(btn);
    }
}


// ========== CONTROLE DA CÂMERA ==========
async function initWebcam() {
    // 🚨 CORREÇÃO DE ID: Usamos o ID do botão de Iniciar/Play
    const playBtn = document.getElementById('play'); 
    
    try {
        atualizarStatus("📷 Solicitando acesso à câmera...");
        if (playBtn) {
            playBtn.disabled = true;
            playBtn.textContent = 'Conectando...';
        }
        
        // A tag <video> no HTML tem ID 'webcam'
        webcam = document.getElementById('webcam'); 
        const constraints = { video: { width: 400, height: 300, facingMode: "user" } };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        webcam.srcObject = stream;
        
        await new Promise((resolve) => {
            webcam.onloadedmetadata = () => { webcam.play().then(resolve); };
        });
        
        habilitarControlesWebcam();
        atualizarStatus("✅ Câmera conectada! Pronto para treinar ou reconhecer.");
        if (playBtn) playBtn.textContent = 'Iniciado';
        
    } catch (error) {
        console.error("Erro ao acessar câmera:", error);
        atualizarStatus("❌ Erro na câmera: " + error.message);
        if (playBtn) {
            playBtn.disabled = false;
            playBtn.textContent = 'Iniciar';
        }
    }
}

function habilitarControlesWebcam() {
    const buttons = ['recognizeBtn', 'stopBtn', 'saveBtn', 'clearBtn', 'captureBtn']; // captureBtn é o Treinar
    buttons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = false;
    });
    
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let letra of letras) {
        const btn = document.getElementById('train' + letra);
        if (btn) btn.disabled = false;
    }
}

// ========== TREINAMENTO POR WEBCAM (Lógica mantida) ==========
async function trainLetter(letra) {
    if (!webcam || !modeloMobileNet || !classificador) {
        alert("Inicie a câmera e aguarde o carregamento da IA!");
        return;
    }
    
    try {
        const imagem = tf.browser.fromPixels(webcam);
        const caracteristicas = modeloMobileNet.infer(imagem, true);
        
        classificador.addExample(caracteristicas, letra);
        
        imagem.dispose();
        caracteristicas.dispose();
        
        const count = classificador.getClassExampleCount()[letra] || 1;
        atualizarStatus(`✅ ${letra} treinada! (${count} amostras)`);
        // atualizarContadorAmostras(); // Chamada removida para simplificar
        
    } catch (error) {
        console.error("Erro no treinamento:", error);
        atualizarStatus("❌ Erro ao treinar " + letra);
    }
}


// ========== INTEGRAÇÃO COM BANCO DE DADOS (API RENDER) ==========
async function buscarGestoDoBD(letraReconhecida, confianca) {
    const palavraChave = letraReconhecida.toUpperCase(); 
    
    try {
        // 🚨 CORREÇÃO: Usando a URL do RENDER
        const response = await fetch(`${RENDER_API_URL}/api/vocabulario/${palavraChave}`); 
        
        if (response.status === 404) {
            atualizarResultado(letraReconhecida, confianca, null); 
            return;
        }
        
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        
        const dadosGesto = await response.json();
        
        atualizarResultado(
            dadosGesto.palavra || letraReconhecida, 
            confianca, 
            dadosGesto.url_imagem 
        );
        
    } catch (error) {
        console.error("❌ Erro ao buscar gesto no BD (Server Down?):", error);
        atualizarResultado(letraReconhecida, confianca, null);
    }
}

// ========== RECONHECIMENTO (Lógica mantida) ==========
async function startRecognition() {
    // ... (Sua lógica de reconhecimento que chama buscarGestoDoBD)
    if (!classificador || Object.keys(classificador.getClassExampleCount()).length === 0) {
        alert("Treine algumas letras primeiro!");
        return;
    }
    
    if (!webcam) {
        alert("Inicie a câmera primeiro!");
        return;
    }

    reconhecendo = true;
    const recognizeBtn = document.getElementById('recognizeBtn');
    if (recognizeBtn) {
        recognizeBtn.textContent = '🔄 Reconhecendo...';
        recognizeBtn.disabled = true;
    }
    
    atualizarStatus("🔍 Reconhecendo... Faça sinais na câmera");
    
    while (reconhecendo) {
        try {
            const imagem = tf.browser.fromPixels(webcam);
            const caracteristicas = modeloMobileNet.infer(imagem, true);
            
            const resultado = await classificador.predictClass(caracteristicas);
            const confianca = (resultado.confidences[resultado.label] * 100);
            
            if (confianca > 50) {
                await buscarGestoDoBD(resultado.label, confianca); 
            } else {
                atualizarResultado("---", 0, null);
            }
            
            imagem.dispose();
            caracteristicas.dispose();
            
            await tf.nextFrame();
            
        } catch (error) {
            if (reconhecendo) console.error("Erro no reconhecimento:", error); 
            break;
        }
    }
    
    if (recognizeBtn) {
        recognizeBtn.textContent = '🔍 Reconhecer';
        recognizeBtn.disabled = false;
    }
}

function stopRecognition() {
    reconhecendo = false;
    atualizarStatus("⏹️ Reconhecimento parado");
}


// ========== SALVAR/CARREGAR MODELO (RENDER) ==========

async function saveModel() {
    // ... (Lógica para salvar modelo no Render)
     // 🚨 CORREÇÃO: Usando a URL do RENDER
     try {
         // ... (converte dataset para JSON)
         await fetch(`${RENDER_API_URL}/api/modelo`, { method: 'POST', body: JSON.stringify(datasetObj) });
         atualizarStatus("✅ Modelo salvo no servidor!");
     } catch (e) { atualizarStatus("❌ Erro ao salvar modelo no servidor."); }
}

async function loadModel() {
    // ... (Lógica para carregar modelo do Render)
    // 🚨 CORREÇÃO: Usando a URL do RENDER
    try {
        const response = await fetch(`${RENDER_API_URL}/api/modelo`);
        // ... (resto da lógica de carregar o modelo)
        if (response.status === 404) { atualizarStatus("ℹ️ Nenhum modelo salvo encontrado no servidor."); return; }
        atualizarStatus("✅ Modelo carregado do servidor!");
        habilitarControlesWebcam(); 
    } catch (e) {
        atualizarStatus("❌ Erro ao carregar modelo do servidor.");
    }
}

// ========== ATUALIZAÇÃO DA INTERFACE (Com imagem BD) ==========
function atualizarResultado(letraOuPalavra, confianca, urlImagem) { 
    const resultadoElem = document.getElementById('resultado');
    const confiancaElem = document.getElementById('confianca');
    const imagemGesto = document.getElementById('imagemGesto'); 

    if (resultadoElem && confiancaElem) {
        resultadoElem.textContent = letraOuPalavra;
        confiancaElem.textContent = `Confiança: ${confianca.toFixed(1)}%`;
        
        const cor = confianca > 80 ? '#2ecc71' : (confianca > 60 ? '#f39c12' : '#e74c3c');
        resultadoElem.style.color = cor;
        
        if (imagemGesto) {
            if (urlImagem) {
                // 🚨 CORREÇÃO: Usando a URL do RENDER
                imagemGesto.src = `${RENDER_API_URL}${urlImagem}`; 
                imagemGesto.style.display = 'block';
            } else {
                imagemGesto.style.display = 'none';
            }
        }
    }
}

function atualizarStatus(mensagem) {
    const statusElem = document.getElementById('status');
    if (statusElem) statusElem.textContent = mensagem;
    
    const statusText = document.getElementById('statusText');
    if (statusText) statusText.textContent = mensagem; 
}

// ... (Outras funções utilitárias como trainBatchImages, atualizarContadorAmostras, clearModel)

// ========== INICIALIZAÇÃO DA PÁGINA ==========
document.addEventListener('DOMContentLoaded', function() {
    inicializarSistema();
});
