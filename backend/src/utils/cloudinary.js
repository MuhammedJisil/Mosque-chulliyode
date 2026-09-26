const cloudinary = require('cloudinary').v2;

const isConfigured = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

if (isConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Upload an image (file path, buffer, or base64 data string) to Cloudinary
 * @param {string} fileInput - file path, buffer, or base64 data URI
 * @param {string} folder - folder name in Cloudinary (default 'mosque_receipts')
 * @returns {Promise<{ url: string, public_id: string } | null>}
 */
const uploadToCloudinary = async (fileInput, folder = 'mosque_receipts') => {
  if (!isConfigured()) {
    return null;
  }

  try {
    const result = await cloudinary.uploader.upload(fileInput, {
      folder,
      resource_type: 'auto',
      quality: 'auto',
      fetch_format: 'auto',
    });

    return {
      url: result.secure_url,
      public_id: result.public_id
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  isConfigured,
  uploadToCloudinary
};
