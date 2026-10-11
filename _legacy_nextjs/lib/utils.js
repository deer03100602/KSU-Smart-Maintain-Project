// ============================================================
// utils.js — Shared Utilities for Helpdesk App
// ============================================================

export function isImageFile(name = '', url = '') {
    const imgExtRegex = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)($|\?)/i;
    if (name && imgExtRegex.test(name)) return true;
    if (url) {
        if (url.startsWith('data:image/')) return true;
        if (imgExtRegex.test(url)) return true;
    }
    return false;
}

export function parseDescriptionAndAttachments(rawDescription) {
    if (!rawDescription) return { cleanDescription: '', attachments: [] };

    const attachments = [];
    const lines = rawDescription.split('\n');
    const cleanLines = [];

    // Regex matching markdown link/image syntax, e.g.:
    // 📎 [filename](url)
    // [ไฟล์แนบ: filename](url)
    // [filename](url)
    // ![filename](url)
    const attachmentRegex = /(?:📎\s*)?\[(?:ไฟล์แนบ:\s*)?(.*?)\]\((.*?)\)|!\[(.*?)\]\((.*?)\)/g;

    for (let line of lines) {
        const trimmedLine = line.trim();
        let match;
        let lineHasAttachment = false;

        attachmentRegex.lastIndex = 0;

        while ((match = attachmentRegex.exec(trimmedLine)) !== null) {
            lineHasAttachment = true;
            const rawName = match[1] || match[3] || 'ไฟล์แนบ';
            const cleanName = rawName.replace(/^ไฟล์แนบ:\s*/i, '').trim();
            let url = match[2] || match[4] || '#';

            // Smart URL fallback if dummy '#' url was saved
            if ((!url || url === '#') && cleanName) {
                url = `/uploads/${encodeURIComponent(cleanName)}`;
            }

            if (!attachments.some(a => a.name === cleanName && a.url === url)) {
                attachments.push({
                    name: cleanName,
                    url: url,
                    isImage: isImageFile(cleanName, url)
                });
            }
        }

        // If line is purely an attachment link or emoji prefix, exclude it from clean description
        if (lineHasAttachment || trimmedLine.startsWith('📎') || /^\s*\[(ไฟล์แนบ:.*?)\]\(.*?\)\s*$/.test(trimmedLine)) {
            continue;
        }

        cleanLines.push(line);
    }

    // Secondary regex check on combined cleanLines to remove any inline attachment codes
    let cleanText = cleanLines.join('\n').trim();
    cleanText = cleanText.replace(/(?:📎\s*)?\[(?:ไฟล์แนบ:\s*)?.*?\]\((.*?)\)/gi, '');
    cleanText = cleanText.replace(/!\[.*?\]\((.*?)\)/gi, '');
    cleanText = cleanText.replace(/📎/g, '').trim();

    return {
        cleanDescription: cleanText,
        attachments
    };
}
