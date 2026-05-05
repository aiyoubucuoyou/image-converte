// ==================== 全局变量 ====================
let originalFile = null;
let originalImage = null;
let compressedBlob = null;
let batchImages = [];
let compressionInProgress = false;
let compressionTimeout = null;

// 常量
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
const COMPRESSION_DEBOUNCE_DELAY = 300; // 防抖延迟（毫秒）
const CRC_TABLE = createCrcTable();

// ==================== DOM 元素 ====================
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const controlSection = document.getElementById('controlSection');
const batchSection = document.getElementById('batchSection');
const previewSection = document.getElementById('previewSection');
const actionSection = document.getElementById('actionSection');

const qualitySlider = document.getElementById('qualitySlider');
const qualityValue = document.getElementById('qualityValue');
const scaleSelect = document.getElementById('scaleSelect');
const formatSelect = document.getElementById('formatSelect');

const originalImageEl = document.getElementById('originalImage');
const compressedCanvas = document.getElementById('compressedCanvas');

const originalSize = document.getElementById('originalSize');
const originalDimensions = document.getElementById('originalDimensions');
const compressedSize = document.getElementById('compressedSize');
const compressionRatio = document.getElementById('compressionRatio');
const savedSpace = document.getElementById('savedSpace');
const compressionPercent = document.getElementById('compressionPercent');
const batchSummary = document.getElementById('batchSummary');
const batchList = document.getElementById('batchList');

const downloadBtn = document.getElementById('downloadBtn');
const batchDownloadBtn = document.getElementById('batchDownloadBtn');
const folderExportBtn = document.getElementById('folderExportBtn');
const resetBtn = document.getElementById('resetBtn');

// ==================== 事件监听 ====================

// 上传区域点击
uploadArea.addEventListener('click', () => fileInput.click());

// 文件输入变化
fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length) {
        handleFilesSelect(files);
    }
});

// 拖拽上传
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length) {
        handleFilesSelect(files);
    }
});

// 质量滑块变化（带防抖）
qualitySlider.addEventListener('input', (e) => {
    qualityValue.textContent = e.target.value + '%';
    if (batchImages.length) {
        debounceCompress();
    }
});

// 尺寸缩放变化
scaleSelect.addEventListener('change', () => {
    if (batchImages.length) {
        debounceCompress();
    }
});

// 格式选择变化
formatSelect.addEventListener('change', () => {
    if (batchImages.length) {
        debounceCompress();
    }
});

// 下载按钮
downloadBtn.addEventListener('click', downloadCompressedImage);
batchDownloadBtn.addEventListener('click', downloadBatchImages);
folderExportBtn.addEventListener('click', exportBatchToFolder);

// 重置按钮
resetBtn.addEventListener('click', resetForm);

// ==================== 文件处理函数 ====================

/**
 * 处理多文件选择
 */
async function handleFilesSelect(files) {
    const validFiles = [];

    files.forEach((file) => {
        if (!file.type.startsWith('image/')) {
            showErrorMessage(`${file.name} 不是有效的图片文件`);
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            showErrorMessage(`${file.name} 过大，请选择 ${MAX_FILE_SIZE / 1024 / 1024}MB 以下的图片`);
            return;
        }

        validFiles.push(file);
    });

    if (!validFiles.length) return;

    try {
        const loadedImages = await Promise.all(validFiles.map(loadImageFile));
        batchImages = loadedImages;
        originalFile = batchImages[0].file;
        originalImage = batchImages[0].image;

        displayOriginalImage();
        renderBatchList();
        showControlPanel();
        await compressImage();
        showSuccessMessage(`已导入 ${batchImages.length} 张图片`);
    } catch (error) {
        showErrorMessage(error.message || '图片加载失败，请检查文件是否损坏');
    }
}

/**
 * 读取图片文件
 */
function loadImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                resolve({
                    file,
                    image: img,
                    compressedBlob: null,
                    compressedSize: 0
                });
            };
            img.onerror = () => reject(new Error(`${file.name} 加载失败`));
            img.src = e.target.result;
        };

        reader.onerror = () => reject(new Error(`${file.name} 读取失败`));
        reader.readAsDataURL(file);
    });
}

/**
 * 处理文件选择
 */
function handleFileSelect(file) {
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
        showErrorMessage('请选择有效的图片文件');
        return;
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
        showErrorMessage(`文件过大，请选择 ${MAX_FILE_SIZE / 1024 / 1024}MB 以下的图片`);
        return;
    }

    originalFile = file;

    // 读取文件
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            originalImage = img;
            displayOriginalImage();
            showControlPanel();
            compressImage();
            showSuccessMessage('图片加载成功');
        };
        img.onerror = () => {
            showErrorMessage('图片加载失败，请检查文件是否损坏');
        };
        img.src = e.target.result;
    };
    reader.onerror = () => {
        showErrorMessage('文件读取失败，请重试');
    };
    reader.readAsDataURL(file);
}

/**
 * 渲染批量图片列表
 */
function renderBatchList() {
    batchSummary.textContent = `已选择 ${batchImages.length} 张图片`;
    batchList.innerHTML = '';

    batchImages.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'batch-item';
        row.dataset.index = index;

        row.innerHTML = `
            <img class="batch-thumb" src="${item.image.src}" alt="${escapeHtml(item.file.name)}">
            <div class="batch-meta">
                <strong title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</strong>
                <span>${item.image.width} × ${item.image.height} px · ${formatSize(item.file.size)}</span>
            </div>
            <div class="batch-result" id="batchResult-${index}">等待处理</div>
        `;

        row.addEventListener('click', () => selectBatchImage(index));
        batchList.appendChild(row);
    });

    selectBatchImage(0);
}

/**
 * 选择批量图片作为预览对象
 */
function selectBatchImage(index) {
    const item = batchImages[index];
    if (!item) return;

    originalFile = item.file;
    originalImage = item.image;
    compressedBlob = item.compressedBlob;
    displayOriginalImage();

    if (item.compressedBlob) {
        drawPreviewCanvas(item.image, parseInt(scaleSelect.value) / 100);
        updateCompressionInfo(item.compressedBlob);
    }

    document.querySelectorAll('.batch-item').forEach((row) => {
        row.classList.toggle('active', Number(row.dataset.index) === index);
    });
}

/**
 * 显示原图
 */
function displayOriginalImage() {
    originalImageEl.src = originalImage.src;
    
    // 显示原图信息
    const originalSizeKB = (originalFile.size / 1024).toFixed(2);
    originalSize.textContent = originalSizeKB + ' KB';
    originalDimensions.textContent = originalImage.width + ' × ' + originalImage.height + ' px';
}

/**
 * 显示控制面板
 */
function showControlPanel() {
    controlSection.style.display = 'block';
    batchSection.style.display = batchImages.length > 1 ? 'block' : 'none';
    previewSection.style.display = 'block';
    actionSection.style.display = 'flex';
    downloadBtn.style.display = batchImages.length > 1 ? 'none' : 'inline-flex';
    batchDownloadBtn.style.display = batchImages.length > 1 ? 'inline-flex' : 'none';
    folderExportBtn.style.display = batchImages.length > 1 ? 'inline-flex' : 'none';
}

// ==================== 图片压缩函数 ====================

/**
 * 防抖压缩函数
 */
function debounceCompress() {
    if (compressionTimeout) {
        clearTimeout(compressionTimeout);
    }
    compressionTimeout = setTimeout(() => {
        compressImage();
    }, COMPRESSION_DEBOUNCE_DELAY);
}

/**
 * 压缩图片
 */
async function compressImage() {
    if (!batchImages.length && originalImage) {
        batchImages = [{
            file: originalFile,
            image: originalImage,
            compressedBlob: null,
            compressedSize: 0
        }];
    }

    if (!batchImages.length) return;

    compressionInProgress = true;
    setActionButtonsDisabled(true);

    const quality = parseInt(qualitySlider.value) / 100;
    const scale = parseInt(scaleSelect.value) / 100;
    const format = formatSelect.value;

    try {
        for (let i = 0; i < batchImages.length; i++) {
            const item = batchImages[i];
            updateBatchResult(i, '处理中...');
            item.compressedBlob = await compressImageItem(item.image, quality, scale, format);
            item.compressedSize = item.compressedBlob.size;
            updateBatchResult(i, `已处理 · ${formatSize(item.compressedBlob.size)}`);
        }

        const selectedIndex = Math.max(0, batchImages.findIndex(item => item.file === originalFile));
        const selectedItem = batchImages[selectedIndex] || batchImages[0];
        originalFile = selectedItem.file;
        originalImage = selectedItem.image;
        compressedBlob = selectedItem.compressedBlob;
        drawPreviewCanvas(selectedItem.image, scale);
        updateCompressionInfo(selectedItem.compressedBlob);
        updateBatchSummary();
    } finally {
        compressionInProgress = false;
        setActionButtonsDisabled(false);
    }
}

/**
 * 压缩单个图片对象
 */
function compressImageItem(image, quality, scale, format) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const newWidth = Math.round(image.width * scale);
        const newHeight = Math.round(image.height * scale);

        canvas.width = newWidth;
        canvas.height = newHeight;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, 0, 0, newWidth, newHeight);

        canvas.toBlob((blob) => resolve(blob), getMimeType(format), quality);
    });
}

/**
 * 绘制当前预览 Canvas
 */
function drawPreviewCanvas(image, scale) {

    // 计算新尺寸
    const newWidth = Math.round(image.width * scale);
    const newHeight = Math.round(image.height * scale);

    // 设置 Canvas 尺寸
    compressedCanvas.width = newWidth;
    compressedCanvas.height = newHeight;

    // 获取 Canvas 上下文
    const ctx = compressedCanvas.getContext('2d', { willReadFrequently: true });

    // 启用图片平滑处理
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 绘制图片
    ctx.drawImage(image, 0, 0, newWidth, newHeight);
}

/**
 * 获取 MIME 类型
 */
function getMimeType(format) {
    const mimeTypes = {
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp'
    };
    return mimeTypes[format] || 'image/jpeg';
}

/**
 * 更新压缩信息
 */
function updateCompressionInfo(blob) {
    if (!blob) return;

    const compressedSizeKB = (blob.size / 1024).toFixed(2);
    const originalSizeKB = (originalFile.size / 1024).toFixed(2);
    const ratio = ((blob.size / originalFile.size) * 100).toFixed(2);
    const saved = (originalFile.size - blob.size) / 1024;
    const savedPercent = (100 - ratio).toFixed(2);

    // 更新 DOM
    compressedSize.textContent = compressedSizeKB + ' KB';
    compressionRatio.textContent = ratio + '%';
    savedSpace.textContent = saved.toFixed(2) + ' KB';
    compressionPercent.textContent = savedPercent + '%';

    // 更新 Canvas 尺寸显示
    const scale = parseInt(scaleSelect.value);
    if (scale !== 100) {
        const newWidth = Math.round(originalImage.width * scale / 100);
        const newHeight = Math.round(originalImage.height * scale / 100);
        // 尺寸信息已在 Canvas 中显示
    }
}

/**
 * 更新批量列表单项结果
 */
function updateBatchResult(index, text) {
    const resultEl = document.getElementById(`batchResult-${index}`);
    if (resultEl) {
        resultEl.textContent = text;
    }
}

/**
 * 更新批量统计
 */
function updateBatchSummary() {
    const originalTotal = batchImages.reduce((total, item) => total + item.file.size, 0);
    const compressedTotal = batchImages.reduce((total, item) => total + (item.compressedSize || 0), 0);
    const savedTotal = originalTotal - compressedTotal;
    batchSummary.textContent = `已选择 ${batchImages.length} 张图片 · 原始 ${formatSize(originalTotal)} · 处理后 ${formatSize(compressedTotal)} · 节省 ${formatSize(savedTotal)}`;
}

// ==================== 下载函数 ====================

/**
 * 下载压缩后的图片
 */
function downloadCompressedImage() {
    if (!compressedBlob) {
        showErrorMessage('请先上传并压缩图片');
        return;
    }

    try {
        // 生成文件名
        const timestamp = new Date().getTime();
        const format = formatSelect.value;
        const filename = `compressed_${timestamp}.${format}`;

        // 创建下载链接
        const url = URL.createObjectURL(compressedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // 显示成功提示
        showCenterSuccessMessage('已发起下载，请在浏览器下载列表查看进度');
        showSuccessMessage(`✅ 已开始下载: ${filename}`);
    } catch (error) {
        showErrorMessage('下载失败，请重试');
        console.error('Download error:', error);
    }
}

/**
 * 批量下载处理后的图片
 */
async function downloadBatchImages() {
    if (!batchImages.length || batchImages.some(item => !item.compressedBlob)) {
        showErrorMessage('请等待批量修改完成后再导出');
        return;
    }

    try {
        setActionButtonsDisabled(true);
        const files = await Promise.all(batchImages.map(async (item) => ({
            name: getOutputFilename(item.file.name),
            data: new Uint8Array(await item.compressedBlob.arrayBuffer())
        })));
        const zipBlob = createZipBlob(files);
        const timestamp = new Date().getTime();
        downloadBlob(zipBlob, `compressed_images_${timestamp}.zip`);
        showCenterSuccessMessage(`ZIP 打包完成，已导出 ${batchImages.length} 张图片`);
        showSuccessMessage(`已打包导出 ${batchImages.length} 张图片`);
    } catch (error) {
        showErrorMessage('ZIP 打包失败，请重试');
        console.error('ZIP export error:', error);
    } finally {
        setActionButtonsDisabled(false);
    }
}

/**
 * 下载 Blob
 */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * 导出批量图片到用户选择的文件夹
 */
async function exportBatchToFolder() {
    if (!batchImages.length || batchImages.some(item => !item.compressedBlob)) {
        showErrorMessage('请等待批量修改完成后再导出');
        return;
    }

    if (!window.showDirectoryPicker) {
        showErrorMessage('当前浏览器不支持导出到文件夹，请使用 Chrome/Edge，或改用 ZIP 导出');
        return;
    }

    try {
        setActionButtonsDisabled(true);
        const directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });

        for (const item of batchImages) {
            const filename = getOutputFilename(item.file.name);
            const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(item.compressedBlob);
            await writable.close();
        }

        showCenterSuccessMessage(`导出成功，已保存 ${batchImages.length} 张图片到文件夹`);
        showSuccessMessage(`已导出 ${batchImages.length} 张图片到文件夹`);
    } catch (error) {
        if (error.name === 'AbortError') {
            showErrorMessage('已取消选择文件夹，可改用 ZIP 导出');
        } else {
            showErrorMessage('导出到文件夹失败，请检查浏览器权限，或改用 ZIP 导出');
            console.error('Folder export error:', error);
        }
    } finally {
        setActionButtonsDisabled(false);
    }
}

/**
 * 生成输出文件名
 */
function getOutputFilename(originalName) {
    const format = formatSelect.value;
    const baseName = originalName.replace(/\.[^/.]+$/, '');
    return `${baseName}_compressed.${format}`;
}

/**
 * 创建 ZIP 文件 Blob，不依赖第三方库
 */
function createZipBlob(files) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    files.forEach((file) => {
        const filenameBytes = encodeUtf8(file.name);
        const crc = crc32(file.data);
        const localHeader = createLocalFileHeader(filenameBytes, crc, file.data.length);
        const centralHeader = createCentralDirectoryHeader(filenameBytes, crc, file.data.length, offset);

        localParts.push(localHeader, file.data);
        centralParts.push(centralHeader);
        offset += localHeader.length + file.data.length;
    });

    const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
    const endRecord = createEndOfCentralDirectory(files.length, centralSize, offset);

    return new Blob([...localParts, ...centralParts, endRecord], { type: 'application/zip' });
}

/**
 * 创建 ZIP 本地文件头
 */
function createLocalFileHeader(filenameBytes, crc, size) {
    const header = new Uint8Array(30 + filenameBytes.length);
    const view = new DataView(header.buffer);

    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, filenameBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(filenameBytes, 30);

    return header;
}

/**
 * 创建 ZIP 中央目录头
 */
function createCentralDirectoryHeader(filenameBytes, crc, size, offset) {
    const header = new Uint8Array(46 + filenameBytes.length);
    const view = new DataView(header.buffer);

    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0x0800, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, crc, true);
    view.setUint32(20, size, true);
    view.setUint32(24, size, true);
    view.setUint16(28, filenameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, offset, true);
    header.set(filenameBytes, 46);

    return header;
}

/**
 * 创建 ZIP 结束记录
 */
function createEndOfCentralDirectory(fileCount, centralSize, centralOffset) {
    const record = new Uint8Array(22);
    const view = new DataView(record.buffer);

    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, fileCount, true);
    view.setUint16(10, fileCount, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, centralOffset, true);
    view.setUint16(20, 0, true);

    return record;
}

/**
 * UTF-8 编码文件名
 */
function encodeUtf8(text) {
    return new TextEncoder().encode(text);
}

/**
 * 创建 CRC32 表
 */
function createCrcTable() {
    const table = new Uint32Array(256);

    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c >>> 0;
    }

    return table;
}

/**
 * 计算 CRC32
 */
function crc32(data) {
    let crc = 0xffffffff;

    for (let i = 0; i < data.length; i++) {
        crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
}

/**
 * 显示成功提示
 */
function showSuccessMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'success-message';
    messageEl.textContent = message;
    
    const mainContent = document.querySelector('.main-content');
    mainContent.insertBefore(messageEl, mainContent.firstChild);

    // 3 秒后移除
    setTimeout(() => {
        messageEl.remove();
    }, 3000);
}

/**
 * 显示居中的成功提示
 */
function showCenterSuccessMessage(message) {
    const oldMessage = document.querySelector('.center-success-message');
    if (oldMessage) {
        oldMessage.remove();
    }

    const messageEl = document.createElement('div');
    messageEl.className = 'center-success-message';
    messageEl.innerHTML = `
        <div class="center-success-icon">✓</div>
        <div class="center-success-text">${escapeHtml(message)}</div>
    `;

    document.body.appendChild(messageEl);

    setTimeout(() => {
        messageEl.classList.add('hide');
    }, 1800);

    setTimeout(() => {
        messageEl.remove();
    }, 2300);
}

/**
 * 显示错误提示
 */
function showErrorMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'error-message';
    messageEl.textContent = '❌ ' + message;
    
    const mainContent = document.querySelector('.main-content');
    mainContent.insertBefore(messageEl, mainContent.firstChild);

    // 5 秒后移除
    setTimeout(() => {
        messageEl.remove();
    }, 5000);
}

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(2)} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * 转义 HTML，避免文件名影响页面结构
 */
function escapeHtml(text) {
    return text.replace(/[&<>"]/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;'
    }[char]));
}

/**
 * 设置操作按钮状态
 */
function setActionButtonsDisabled(disabled) {
    downloadBtn.disabled = disabled;
    batchDownloadBtn.disabled = disabled;
    folderExportBtn.disabled = disabled;
}

// ==================== 重置函数 ====================

/**
 * 重置表单
 */
function resetForm() {
    // 重置变量
    originalFile = null;
    originalImage = null;
    compressedBlob = null;
    batchImages = [];

    // 重置 DOM
    fileInput.value = '';
    originalImageEl.src = '';
    compressedCanvas.width = 0;
    compressedCanvas.height = 0;

    // 重置信息显示
    batchList.innerHTML = '';
    batchSummary.textContent = '已选择 0 张图片';
    originalSize.textContent = '-';
    originalDimensions.textContent = '-';
    compressedSize.textContent = '-';
    compressionRatio.textContent = '-';
    savedSpace.textContent = '-';
    compressionPercent.textContent = '-';

    // 重置控制面板
    qualitySlider.value = 80;
    qualityValue.textContent = '80%';
    scaleSelect.value = '100';
    formatSelect.value = 'jpeg';

    // 隐藏控制面板和预览
    controlSection.style.display = 'none';
    batchSection.style.display = 'none';
    previewSection.style.display = 'none';
    actionSection.style.display = 'none';

    // 移除拖拽样式
    uploadArea.classList.remove('dragover');

    // 显示成功提示
    showSuccessMessage('已重置，可以上传新图片');
}

// ==================== 初始化 ====================

console.log('图片压缩工具已加载');
