/**
 * API Helper & Resilient Global Fetch Interceptor
 * KSU Smart Maintain (Kalasin University)
 *
 * Ensures:
 * 1. Automatic subpath resolution (e.g. /app/ksu-smart-maintain when deployed behind university reverse proxy)
 * 2. Guaranteed safe JSON parsing: NEVER throws "Unexpected token '<', '<!DOCTYPE '... is not valid JSON"
 * 3. User-friendly Thai error messages on network/gateway errors
 */

export function getAppSubpath() {
    if (typeof window === 'undefined') return '';
    const pathname = window.location.pathname || '';

    // If deployed on university server at /app/ksu-smart-maintain
    if (pathname.includes('/app/ksu-smart-maintain')) {
        return '/app/ksu-smart-maintain';
    }

    // Generic subpath detection if running under a directory
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0 && segments[segments.length - 1].includes('.')) {
        segments.pop(); // Remove index.html or other file
    }
    if (segments.length > 0) {
        return '/' + segments.join('/');
    }

    return '';
}

export function resolveApiUrl(url) {
    if (typeof url !== 'string') return url;

    // Do not alter full URLs (http:// or https://)
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }

    const subpath = getAppSubpath();
    if (!subpath) return url;

    if (url.startsWith('/api') && !url.startsWith(subpath + '/api')) {
        return `${subpath}${url}`;
    }
    if (url.startsWith('/uploads') && !url.startsWith(subpath + '/uploads')) {
        return `${subpath}${url}`;
    }

    return url;
}

// Global window.fetch monkey-patch to ensure resilience across all components
if (typeof window !== 'undefined' && !window.__KSU_FETCH_SHIELD_INITIALIZED__) {
    window.__KSU_FETCH_SHIELD_INITIALIZED__ = true;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async function (resource, init) {
        let finalResource = resource;

        if (typeof resource === 'string') {
            finalResource = resolveApiUrl(resource);
        } else if (resource instanceof Request) {
            const resolvedUrl = resolveApiUrl(resource.url);
            if (resolvedUrl !== resource.url) {
                finalResource = new Request(resolvedUrl, resource);
            }
        }

        try {
            const response = await originalFetch(finalResource, init);

            // Wrap response.json() so HTML/text responses never throw SyntaxError
            const originalJsonMethod = response.json.bind(response);
            response.json = async function () {
                try {
                    const clone = response.clone();
                    const text = await clone.text();
                    const trimmed = (text || '').trim();

                    // Detect HTML error responses (<!DOCTYPE html>, <html>, etc.)
                    if (trimmed.startsWith('<') || trimmed.toLowerCase().startsWith('<!doctype')) {
                        console.warn('⚠️ Server returned HTML instead of JSON for:', finalResource, 'Status:', response.status);
                        return {
                            _isHtmlResponse: true,
                            ok: response.ok,
                            status: response.status,
                            error: response.ok
                                ? 'เซิร์ฟเวอร์ส่งคืนข้อมูลแบบหน้าเว็บ HTML กรุณารีเฟรชหน้าต่าง'
                                : `การเชื่อมต่อเซิร์ฟเวอร์ขัดข้อง (รหัสสถานะ: ${response.status})`
                        };
                    }

                    if (!trimmed) {
                        return { ok: response.ok, status: response.status };
                    }

                    return JSON.parse(text);
                } catch (jsonErr) {
                    console.warn('⚠️ JSON parse fallback triggered for:', finalResource, jsonErr);
                    return {
                        _isParseError: true,
                        ok: response.ok,
                        status: response.status,
                        error: `รูปแบบข้อมูลจากเซิร์ฟเวอร์ไม่ถูกต้อง (${response.status})`
                    };
                }
            };

            return response;
        } catch (fetchErr) {
            console.error('🚨 Network error during fetch:', finalResource, fetchErr);
            throw fetchErr;
        }
    };
}
