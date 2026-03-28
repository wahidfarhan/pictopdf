const folderInput = document.getElementById('folder-input');
const folderPath = document.getElementById('folder-path');
const fileCountLabel = document.getElementById('file-count');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const downloadTxtBtn = document.getElementById('download-txt-btn');
const downloadPdfBtn = document.getElementById('download-pdf-btn');
const checkApiBtn = document.getElementById('check-api-btn');
const viewRawBtn = document.getElementById('view-raw-btn');
const viewRenderBtn = document.getElementById('view-render-btn');
const previewImg = document.getElementById('preview-img');
const statusLabel = document.getElementById('status-label');
const textDisplay = document.getElementById('text-display');
const statusLog = document.getElementById('status-log');

// --- Configuration ---
const API_KEYS = [
    "AIzaSyCo4yay8AkSJAyh-rGwuo9P4z706GI5eAQ",
    "AIzaSyBOVtHz_i09oM3zcrGxDQV22alDpbaOElk"
];
const MODEL_ID = "gemini-3-flash-preview";
const SYSTEM_PROMPT = `তুমি একজন ডাটা এক্সট্রাকশন স্পেশালিস্ট। তোমার কাজ হলো ছবি থেকে তথ্য নিয়ে নিচের ফরম্যাটে দেওয়া।

[নির্দেশনা]:
১. কোনো প্রকার LaTeX বা MathML বা $ চিহ্ন ব্যবহার করবে না। শুধুমাত্র AsciiMath (http://asciimath.org/#syntax) ফর্ম্যাট ব্যবহার করবে।
২. প্রতিটি গাণিতিক সমীকরণ, রাশি, এবং ম্যাট্রিক্সের দুই পাশে অবশ্যই Single Backtick (\`) ব্যবহার করবে। (যেমন: \`sqrt(47)\`)
৩. AsciiMath সিনট্যাক্সের নিয়মগুলো খুব কঠোরভাবে মেনে চলবে:
   - ভগ্নাংশ: \`a/b\` অথবা \`(a+b)/(c-d)\`
   - রুট/বর্গমূল: \`sqrt(x)\` বা \`root(n)(x)\`
   - পাওয়ার ও সাবস্ক্রিপ্ট: \`x^2\`, \`v_0\`, \`sum_(i=1)^n\`
   - ভেক্টর বা ম্যাট্রিক্স: কলাম ভেক্টর \`((a),(b))\`, ম্যাট্রিক্স \`[[a,b],[c,d]]\`
   - স্পেশাল ফাংশন: \`sin(x)\`, \`lim_(x->0)\`, \`int_0^1 f(x)dx\`
   - সিম্বল: অসীম বোঝাতে \`oo\`, ভেক্টর \`vec E\`, একক ভেক্টর \`hat i, hat j, hat k\`, গুণন চিহ্ন \`xx\`, ডট গুণন \`*\`
৪. আউটপুট হুবহু নিচের ব্লকের মতো হতে হবে:

[Question]
(ছবির প্রশ্নটি এখানে লিখবে)

[Options]
(ক) [অপশন ১]
(খ) [অপশন ২]
(গ) [অপশন ৩]
(ঘ) [অপশন ৪]

[Explanation]
(ছবির সমাধানটি এখানে দিবে। সমস্ত গাণিতিক টার্ম AsciiMath স্টাইলে লিখবে)`;

// --- State Variables ---
let imageFiles = [];
let isProcessing = false;
let currentKeyIndex = 0;
let questionCounter = 1;
let processedCount = 0;
let finalOutputData = "";
let currentViewMode = "raw";

// Supported image extensions
const validExtensions = ['.jpg', '.jpeg', '.png'];

folderInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    imageFiles = files.filter(file => {
        const name = file.name.toLowerCase();
        return validExtensions.some(ext => name.endsWith(ext));
    });

    if (imageFiles.length > 0) {
        folderPath.value = "Selected folder with " + imageFiles.length + " images";
        fileCountLabel.textContent = `Found ${imageFiles.length} valid images.`;
        logMessage(`Found ${imageFiles.length} images. Ready to start.`);
        downloadTxtBtn.disabled = true;
        downloadPdfBtn.disabled = true;

        // INSTANTLY SHOW FIRST IMAGE PREVIEW ON LOAD
        displayImagePreview(imageFiles[0]);
    } else {
        folderPath.value = "";
        fileCountLabel.textContent = "No valid images found in folder.";
        logMessage("No images found in the selected folder.");
    }
});

startBtn.addEventListener('click', () => {
    if (imageFiles.length === 0) {
        alert("Please select a valid folder containing images.");
        return;
    }

    // Reset state
    isProcessing = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    folderInput.disabled = true;
    downloadTxtBtn.disabled = true;
    downloadPdfBtn.disabled = true;
    textDisplay.innerHTML = '';
    questionCounter = 1;
    processedCount = 0;
    finalOutputData = "";

    logMessage(`Starting process for ${imageFiles.length} images...`);
    processImagesQueue();
});

stopBtn.addEventListener('click', () => {
    isProcessing = false;
    logMessage("Stopping after current image...");
    stopBtn.disabled = true; // prevent double clicks
});

downloadTxtBtn.addEventListener('click', () => {
    if (!finalOutputData) return;

    // Remove all single backticks before saving the file so the user gets clean equations
    const cleanedForDownload = finalOutputData.replace(/`/g, "");

    // Create a blob and trigger a download
    const blob = new Blob([cleanedForDownload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Physics_MCQs.txt';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
});

downloadPdfBtn.addEventListener('click', () => {
    if (!finalOutputData) return;

    downloadPdfBtn.textContent = "⏳ generating...";
    downloadPdfBtn.disabled = true;

    const opt = {
        margin: 0.5,
        filename: 'Physics_MCQ_Output.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    // Passing HTML as a string forces html2pdf to build a clean iframe, bypassing the Blank Page bug caused by offscreen DOM bounds
    const pdfHtml = `
        <div style="font-family: Arial, sans-serif; color: #000000; background-color: #ffffff; white-space: pre-wrap; font-size: 14px;">
            <style>
                .tag-question { color: #1D4ED8 !important; font-weight: bold; font-size: 16px; margin-top: 15px; display: inline-block;}
                .tag-options { color: #15803D !important; font-weight: bold; margin-top: 10px; display: inline-block;}
                .tag-explanation { color: #B45309 !important; font-weight: bold; margin-top: 15px; display: inline-block;}
            </style>
            ${textDisplay.innerHTML}
        </div>
    `;

    html2pdf().set(opt).from(pdfHtml).save().then(() => {
        downloadPdfBtn.textContent = "📄 PDF";
        downloadPdfBtn.disabled = false;
    }).catch(e => {
        alert("Error saving PDF.");
        downloadPdfBtn.textContent = "📄 PDF";
        downloadPdfBtn.disabled = false;
    });
});

checkApiBtn.addEventListener('click', async () => {
    const keyToCheck = prompt("Please enter the Gemini API Key you want to check:");
    if (!keyToCheck || keyToCheck.trim() === "") return;

    checkApiBtn.disabled = true;
    checkApiBtn.textContent = "⏳ Checking...";
    logMessage("Checking API Limit for key...");

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${keyToCheck.trim()}`;
        const response = await fetch(url, { method: 'GET' });

        if (response.ok) {
            alert("✅ Valid API Key! You have API limit remaining.");
            logMessage(`API Limit Check: Key is VALID and active.`);
        } else if (response.status === 429) {
            alert("❌ QUOTA EXCEEDED! This API key limit is finished.");
            logMessage(`API Limit Check: Quota Exceeded for this key.`);
        } else if (response.status === 400 || response.status === 403) {
            alert("🚫 INVALID API KEY! Please check the key again.");
            logMessage(`API Limit Check: Key is invalid or restricted.`);
        } else {
            alert(`⚠️ Error checking key: Status ${response.status}`);
            logMessage(`API Limit Check: Unknown error ${response.status}`);
        }
    } catch (err) {
        alert("⚠️ Network Error while checking API key.");
        logMessage(`API Limit Check Error: ${err.message}`);
    } finally {
        checkApiBtn.disabled = false;
        checkApiBtn.textContent = "🔑 Check API Limit";
    }
});

function logMessage(msg) {
    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' +
        now.getMinutes().toString().padStart(2, '0') + ':' +
        now.getSeconds().toString().padStart(2, '0');
    statusLog.textContent += `[${time}] ${msg}\n`;
    statusLog.scrollTop = statusLog.scrollHeight;
}

function updateStatus(msg) {
    statusLabel.textContent = msg;
}

function displayImagePreview(file) {
    try {
        if (previewImg.src && previewImg.src.startsWith('blob:')) {
            URL.revokeObjectURL(previewImg.src); // Free up old memory safely
        }
        const objectUrl = URL.createObjectURL(file);
        previewImg.src = objectUrl;
        previewImg.style.display = 'block';
    } catch (e) {
        logMessage("Preview Error: " + e.message);
    }
}

viewRawBtn.addEventListener('click', () => {
    currentViewMode = "raw";
    viewRawBtn.classList.add('active');
    viewRenderBtn.classList.remove('active');
    renderOutputView();
});

viewRenderBtn.addEventListener('click', () => {
    currentViewMode = "render";
    viewRenderBtn.classList.add('active');
    viewRawBtn.classList.remove('active');
    renderOutputView();
});

function appendToDisplay(text) {
    finalOutputData += text;
    renderOutputView();
}

// Colorizes the text similar to Tkinter tags and applies MathJax if in Render mode
function renderOutputView() {
    let htmlContent = "";

    if (finalOutputData) {
        // Escape standard HTML first
        const escapeEl = document.createElement('div');
        escapeEl.innerText = finalOutputData;
        htmlContent = escapeEl.innerHTML;

        // Apply specific color tags
        htmlContent = htmlContent.replace(/\[Question\]/gi, '<span class="tag-question">[Question]</span>');
        htmlContent = htmlContent.replace(/\[Options\]/gi, '<span class="tag-options">[Options]</span>');
        htmlContent = htmlContent.replace(/\[Explanation\]/gi, '<span class="tag-explanation">[Explanation]</span>');

        // If viewing in RAW mode, strip out backticks so the user doesn't see them!
        if (currentViewMode === "raw") {
            htmlContent = htmlContent.replace(/`/g, "");
        }
    }

    textDisplay.innerHTML = htmlContent;

    if (currentViewMode === "render" && window.MathJax && finalOutputData) {
        MathJax.Hub.Queue(["Typeset", MathJax.Hub, textDisplay]);
    }

    textDisplay.scrollTop = textDisplay.scrollHeight;
}

function cleanOutput(text) {
    if (!text) return "";
    let cleaned = text;
    // Removed "{" and "}" because AsciiMath syntax uses them for layout grouping and matrices!
    // Kept "`" single backticks because MathJax requires them! They are stripped right before download instead!
    const forbiddenChars = ["$", "\\", "```latex", "```asciimath", "```"];
    forbiddenChars.forEach(char => {
        // Simple string replace for characters
        cleaned = cleaned.split(char).join("");
    });

    // Replace Bengali 'or' notation with AsciiMath implication arrow
    cleaned = cleaned.replace(/বা,/g, "=>");

    return cleaned.trim();
}

async function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]); // remove data part
        reader.onerror = error => reject(error);
    });
}

async function processSingleImage(file, index) {
    const maxAttempts = 6;
    let attempts = 0;
    while (attempts < maxAttempts && isProcessing) {
        try {
            const base64Image = await getBase64(file);
            const activeKey = API_KEYS[currentKeyIndex];
            const mimeType = "image/" + (file.name.toLowerCase().endsWith(".png") ? "png" : "jpeg");

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${activeKey}`;

            const payload = {
                contents: [
                    {
                        parts: [
                            { text: SYSTEM_PROMPT },
                            {
                                inline_data: {
                                    mime_type: mimeType,
                                    data: base64Image
                                }
                            }
                        ]
                    }
                ]
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMsg = data.error ? data.error.message : response.statusText;
                const isQuotaError = response.status === 429 || errorMsg.toLowerCase().includes('quota');
                const isServerOverload = response.status === 503 || errorMsg.toLowerCase().includes('high demand') || response.status >= 500;

                if (isQuotaError) {
                    logMessage(`Quota Full for Key ${currentKeyIndex + 1}. Switching...`);
                    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
                    attempts++;
                    await new Promise(r => setTimeout(r, 8000)); // Wait before retrying
                    continue;
                } else if (isServerOverload) {
                    logMessage(`High demand. Server is busy. Retrying in 10 seconds... (Attempt ${attempts + 1})`);
                    attempts++;
                    await new Promise(r => setTimeout(r, 10000)); // Wait 10 seconds before retrying
                    continue;
                } else {
                    throw new Error(errorMsg);
                }
            }

            // Extract the text
            let extractedText = "";
            if (data.candidates && data.candidates[0] && data.candidates[0].content.parts[0].text) {
                extractedText = data.candidates[0].content.parts[0].text;
            }

            const cleanedText = cleanOutput(extractedText);

            if (cleanedText.length < 20 || !cleanedText.includes('[Question]')) {
                logMessage(`[WARNING] File: ${file.name} | Status: Low Confidence/Bad Format`);
            } else {
                logMessage(`File: ${file.name} | Status: Success`);
            }

            return cleanedText;

        } catch (error) {
            logMessage(`Error processing ${file.name}: ${error.message}`);
            return null;
        }
    }
    return null;
}

async function processImagesQueue() {
    for (let i = 0; i < imageFiles.length; i++) {
        if (!isProcessing) {
            logMessage("Stopped by user.");
            break;
        }

        const file = imageFiles[i];
        updateStatus(`Processing: ${i + 1}/${imageFiles.length}`);
        displayImagePreview(file);

        // Force browser to update UI before moving to heavy tasks
        await new Promise(r => setTimeout(r, 50));

        const extractedText = await processSingleImage(file, i);

        if (extractedText) {
            const formattedEntry = `--- Question ${questionCounter}: ${file.name} ---\n${extractedText}\n${'-'.repeat(60)}\n\n`;
            appendToDisplay(formattedEntry);

            questionCounter++;
            processedCount++;
        }

        // Small delay to allow UI refresh without blocking the main thread entirely
        await new Promise(r => setTimeout(r, 100));
    }

    logMessage(`Done. Processed ${processedCount}/${imageFiles.length} images.`);

    // Process finish state
    startBtn.disabled = false;
    stopBtn.disabled = true;
    folderInput.disabled = false;
    updateStatus("System Ready");
    isProcessing = false;

    if (finalOutputData) {
        downloadTxtBtn.disabled = false;
        downloadTxtBtn.style.backgroundColor = "#2563EB";
        downloadTxtBtn.style.color = "white";

        downloadPdfBtn.disabled = false;
        downloadPdfBtn.style.color = "white";

        logMessage("Ready to download. You can download as TXT or PDF.");
    }
}
