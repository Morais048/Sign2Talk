// ====================================================================
// app.js - Lógica Principal e Integração com o Banco de Dados (BD)
// ====================================================================

// ========== VARIÁVEIS GLOBAIS ==========
let modeloMobileNet;
let classificador;
let webcam;
let imagesToTrain = []; // Armazena imagens carregadas por upload
let reconhecendo = false;
let animationFrameId = null; 

// ========== INICIALIZAÇÃO E CARREGAMENTO DE IA ==========
async function inicializarSistema() {
    try {
        atualizarStatus("🔄 Carregando modelo de IA (MobileNet)...");
        modeloMobileNet = await mobilenet.load();
        classificador = knnClassifier.create();
        atualizarStatus("✅ IA carregada! Inicie a Câmera ou Carregue Imagens.");
        document.getElementById('loadBtn').disabled = false;
    } catch (error) {
        console.error("Erro na inicialização:", error);
        atualizarStatus("❌ Erro ao carregar IA: " + error.message);
    }
}

// ========== CONTROLE DA CÂMERA ==========
async function initWebcam() {
    const webcamBtn = document.getElementById('webcamBtn');
    
    try {
        atualizarStatus("📷 Solicitando acesso à câmera...");
        webcamBtn.disabled = true;
        webcamBtn.innerHTML = '<div class="loading"></div> Conectando...';
        
        webcam = document.getElementById('webcam'); 
        const constraints = { video: { width: 400, height: 300, facingMode: "user" } };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        webcam.srcObject = stream;
        
        await new Promise((resolve) => {
            webcam.onloadedmetadata = () => { webcam.play().then(resolve); };
        });
        
        habilitarControlesWebcam();
        atualizarStatus("✅ Câmera conectada! Pronto para treinar ou reconhecer.");
        
    } catch (error) {
        console.error("Erro ao acessar câmera:", error);
        atualizarStatus("❌ Erro na câmera: " + error.message);
        webcamBtn.disabled = false;
        webcamBtn.textContent = '🎥 Iniciar Câmera';
    }
}

function habilitarControlesWebcam() {
    const buttons = ['recognizeBtn', 'stopBtn', 'saveBtn', 'clearBtn'];
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

// ========== TREINAMENTO POR WEBCAM ==========
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
        atualizarContadorAmostras();
        
    } catch (error) {
        console.error("Erro no treinamento:", error);
        atualizarStatus("❌ Erro ao treinar " + letra);
    }
}

// ========== INTEGRAÇÃO COM BANCO DE DADOS (API) ==========
async function buscarGestoDoBD(letraReconhecida, confianca) {
    const palavraChave = letraReconhecida.toUpperCase(); 
    
    try {
        const response = await fetch(`http://localhost:3000/api/vocabulario/${palavraChave}`); 
        
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

// ========== RECONHECIMENTO (COM INTEGRAÇÃO BD) ==========
async function startRecognition() {
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

// ========== TREINAMENTO POR UPLOAD (BATCH) E CORREÇÃO ==========

// Função utilitária para carregar imagem de um arquivo
function loadImageFromFile(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Lida com a seleção de arquivos (tanto clique quanto drag-and-drop)
function handleFileSelect(event) {
    const files = event.target.files || event.dataTransfer.files;
    imagesToTrain = Array.from(files);
    // TODO: Implementar lógica de pré-visualização no #previewGrid
    document.getElementById('fileInput').files = files; // Mantém os arquivos no input
    atualizarStatus(`✅ ${imagesToTrain.length} imagens selecionadas. Escolha a letra e treine.`);
    if(imagesToTrain.length > 0) document.getElementById('trainingProgress').style.display = 'block';
}

/**
 * Treina todas as imagens carregadas com a letra selecionada no dropdown.
 */
async function trainBatchImages() {
    const selectElem = document.getElementById('batchLetterSelect');
    const letraSelecionada = selectElem.value;
    
    if (!letraSelecionada) {
        alert("🚨 Por favor, selecione uma letra no menu suspenso antes de treinar.");
        return;
    }
    
    if (imagesToTrain.length === 0) {
        alert("🚨 Nenhuma imagem carregada. Selecione imagens primeiro.");
        return;
    }
    
    atualizarStatus(`🚀 Iniciando treinamento em lote para a letra: ${letraSelecionada} (${imagesToTrain.length} imagens)`);
    
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    let imagensProcessadas = 0;
    
    for (const file of imagesToTrain) {
        const img = await loadImageFromFile(file);
        
        try {
            const imagemTensor = tf.browser.fromPixels(img);
            const caracteristicas = modeloMobileNet.infer(imagemTensor, true);
            
            // ADICIONA AO CLASSIFICADOR COM O RÓTULO CORRETO
            classificador.addExample(caracteristicas, letraSelecionada); 
            
            imagemTensor.dispose();
            caracteristicas.dispose();
            
            imagensProcessadas++;
            
            // Atualizar progresso visual
            const percent = (imagensProcessadas / imagesToTrain.length) * 100;
            progressFill.style.width = `${percent.toFixed(0)}%`;
            progressText.textContent = `${imagensProcessadas}/${imagesToTrain.length} imagens processadas`;
            
        } catch (error) {
            console.error(`Erro ao processar arquivo ${file.name}:`, error);
        }
    }
    
    atualizarStatus(`✅ Treinamento em lote finalizado para ${letraSelecionada}! Total de amostras: ${classificador.getClassExampleCount()[letraSelecionada]}`);
    imagesToTrain = []; 
    atualizarContadorAmostras();
}

// ========== SALVAR/CARREGAR MODELO (Servidor) ==========

async function saveModel() {
    if (!classificador) return;
    
    try {
        const dataset = classificador.getClassifierDataset();
        const datasetObj = {};
        
        Object.keys(dataset).forEach((key) => {
            const data = dataset[key];
            datasetObj[key] = {
                data: Array.from(data.dataSync()),
                shape: data.shape
            };
        });
        
        atualizarStatus("💾 Salvando modelo no servidor...");
        
        const response = await fetch('http://localhost:3000/api/modelo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datasetObj)
        });
        
        if (!response.ok) throw new Error(`Erro ao salvar: ${response.status}`);
        
        atualizarStatus("✅ Modelo salvo no servidor! (Pronto para ser carregado)");
        
    } catch (error) {
        console.error("❌ Erro ao salvar modelo:", error);
        atualizarStatus("❌ Erro ao salvar modelo no servidor.");
    }
}

async function loadModel() {
    if (!classificador) return;
    
    try {
        atualizarStatus("📂 Buscando modelo do servidor...");
        
        const response = await fetch('http://localhost:3000/api/modelo');
        
        if (response.status === 404) {
            atualizarStatus("ℹ️ Nenhum modelo salvo encontrado no servidor.");
            return;
        }
        
        if (!response.ok) throw new Error(`Erro ao carregar: ${response.status}`);
        
        const datasetObj = await response.json();
        
        const tensorDataset = {};
        Object.keys(datasetObj).forEach((key) => {
            const data = datasetObj[key];
            tensorDataset[key] = tf.tensor(data.data, data.shape);
        });
        
        classificador.setClassifierDataset(tensorDataset);
        atualizarStatus("✅ Modelo carregado do servidor!");
        atualizarContadorAmostras();
        habilitarControlesWebcam(); 
        
    } catch (error) {
        console.error("❌ Erro ao carregar:", error);
        atualizarStatus("❌ Erro ao carregar modelo do servidor.");
    }
}

function clearModel() {
    if (confirm("Tem certeza que quer limpar TODO o treinamento?")) {
        if (classificador) {
            classificador.dispose();
            classificador = knnClassifier.create();
            // TODO: Chamar API para limpar modelo-ia.json no servidor se necessário
            atualizarContadorAmostras();
            atualizarStatus("🧹 Modelo limpo! Comece novamente.");
        }
    }
}

// ========== ATUALIZAÇÃO DA INTERFACE ==========
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
                imagemGesto.src = `http://localhost:3000${urlImagem}`; 
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
}

function atualizarContadorAmostras() {
    if (!classificador) return;
    
    const counts = classificador.getClassExampleCount();
    let texto = '';
    
    Object.keys(counts).sort().forEach(letra => {
        if (counts[letra] > 0) {
            texto += `${letra}: ${counts[letra]} | `;
        }
    });
    
    const amostrasElem = document.getElementById('contadorAmostras');
    if (amostrasElem) amostrasElem.textContent = texto || 'Nenhuma amostra treinada';
}

// ========== INICIALIZAÇÃO DA PÁGINA ==========
document.addEventListener('DOMContentLoaded', function() {
    inicializarSistema();
    // Você pode adicionar um loadModel() automático aqui se quiser que ele carregue o último treino
    // loadModel(); 
});