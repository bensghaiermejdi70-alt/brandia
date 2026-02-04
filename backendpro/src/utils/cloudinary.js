// ============================================
// CLOUDINARY CONFIG - Upload & Transform Images
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
                            height: result.height
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

// Helper: Delete image
const deleteImage = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
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
        return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto,c_${crop}/`);
    }
    
    return url;
};

module.exports = {
    cloudinary,
    uploadImage,
    deleteImage,
    getOptimizedUrl
};