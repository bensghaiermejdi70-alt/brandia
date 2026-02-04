// ============================================
// CLOUDINARY CONFIG - Upload Images & Videos
// ============================================

const cloudinary = require('cloudinary').v2;

// Configuration Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

// Helper: Upload image from buffer
const uploadImage = async (fileBuffer, folder = 'brandia/products') => {
    try {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: folder,
                    resource_type: 'image',
                    transformation: [
                        { width: 1200, height: 1200, crop: 'limit' },
                        { quality: 'auto:good', fetch_format: 'auto' }
                    ]
                },
                (error, result) => {
                    if (error) {
                        console.error('[Cloudinary] Upload error:', error);
                        reject(error);
                    } else {
                        console.log('[Cloudinary] Upload success:', result.public_id);
                        resolve({
                            url: result.secure_url,
                            publicId: result.public_id,
                            width: result.width,
                            height: result.height,
                            resourceType: 'image'
                        });
                    }
                }
            );
            
            uploadStream.end(fileBuffer);
        });
    } catch (error) {
        console.error('[Cloudinary] Error:', error);
        throw error;
    }
};

// ✅ NOUVEAU: Upload video from buffer
const uploadVideo = async (fileBuffer, folder = 'brandia/campaigns') => {
    try {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: folder,
                    resource_type: 'video',
                    transformation: [
                        { width: 1280, height: 720, crop: 'limit' },
                        { quality: 'auto:good', fetch_format: 'auto' },
                        { duration: 15 }
                    ],
                    eager: [
                        { width: 1280, height: 720, crop: 'fill', format: 'jpg' }
                    ]
                },
                (error, result) => {
                    if (error) {
                        console.error('[Cloudinary] Video upload error:', error);
                        reject(error);
                    } else {
                        console.log('[Cloudinary] Video upload success:', result.public_id);
                        resolve({
                            url: result.secure_url,
                            publicId: result.public_id,
                            width: result.width,
                            height: result.height,
                            resourceType: 'video',
                            duration: result.duration,
                            thumbnailUrl: result.eager?.[0]?.secure_url || result.secure_url.replace('.mp4', '.jpg')
                        });
                    }
                }
            );
            
            uploadStream.end(fileBuffer);
        });
    } catch (error) {
        console.error('[Cloudinary] Video Error:', error);
        throw error;
    }
};

// Helper: Delete media
const deleteMedia = async (publicId, resourceType = 'image') => {
    try {
        const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        return result;
    } catch (error) {
        console.error('[Cloudinary] Delete error:', error);
        throw error;
    }
};

// Helper: Generate optimized URL
const getOptimizedUrl = (url, options = {}) => {
    const { width = 800, height = null, crop = 'fill' } = options;
    
    if (url.includes('cloudinary.com')) {
        if (url.endsWith('.mp4') || url.endsWith('.mov')) {
            return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto,c_${crop}/`);
        }
        return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto,c_${crop}/`);
    }
    
    return url;
};

module.exports = {
    cloudinary,
    uploadImage,
    uploadVideo,
    deleteMedia,
    getOptimizedUrl
};