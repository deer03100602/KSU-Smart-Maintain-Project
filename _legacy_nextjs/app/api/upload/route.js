// ============================================================
// route.js — API Endpoint for File Uploads
// Route: /api/upload
// ============================================================

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // Convert file stream to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const fileExt = file.name.split('.').pop() || 'png';
        const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        // 1. Attempt upload to Supabase Storage
        try {
            const bucketName = 'ticket-attachments';
            const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
            
            if (!bucketsError) {
                const bucketExists = buckets?.some(b => b.name === bucketName);
                if (!bucketExists) {
                    await supabase.storage.createBucket(bucketName, {
                        public: true,
                        fileSizeLimit: 10 * 1024 * 1024, // 10MB
                    });
                }

                const filePath = `uploads/${uniqueFileName}`;
                const { error: uploadError } = await supabase.storage
                    .from(bucketName)
                    .upload(filePath, buffer, {
                        contentType: file.type,
                        duplex: 'half'
                    });

                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage
                        .from(bucketName)
                        .getPublicUrl(filePath);

                    if (publicUrl) {
                        return NextResponse.json({
                            url: publicUrl,
                            name: file.name,
                            size: file.size,
                            type: file.type
                        });
                    }
                }
            }
        } catch (supabaseErr) {
            console.warn('Supabase storage upload bypassed/failed, saving locally:', supabaseErr);
        }

        // 2. Fallback: Save file to public/uploads directory
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const localFilePath = path.join(uploadsDir, uniqueFileName);
        fs.writeFileSync(localFilePath, buffer);

        const publicUrl = `/uploads/${uniqueFileName}`;
        return NextResponse.json({
            url: publicUrl,
            name: file.name,
            size: file.size,
            type: file.type
        });

    } catch (e) {
        console.error('API Error in POST /api/upload:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
