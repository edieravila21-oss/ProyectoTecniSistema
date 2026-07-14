const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const useCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY);

let cloudinary = null;
if (useCloudinary) {
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const uploadToCloudinary = (buffer, folder = 'techserv') => {
  if (useCloudinary) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image', transformation: [{ quality: 78, fetch_format: 'auto', width: 1280, crop: 'limit' }] },
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      stream.end(buffer);
    });
  }

  const subDir = path.join(UPLOADS_DIR, folder.replace(/\//g, path.sep));
  ensureDir(subDir);
  const filename = `${crypto.randomUUID()}.jpg`;
  const filePath = path.join(subDir, filename);
  fs.writeFileSync(filePath, buffer);
  const relativePath = `/uploads/${folder}/${filename}`;
  return Promise.resolve({ secure_url: relativePath });
};

const uploadBase64ToCloudinary = async (base64String, folder = 'techserv/firmas') => {
  if (useCloudinary) {
    return cloudinary.uploader.upload(base64String, { folder, resource_type: 'image' });
  }

  const subDir = path.join(UPLOADS_DIR, folder.replace(/\//g, path.sep));
  ensureDir(subDir);
  const matches = base64String.match(/^data:image\/(\w+);base64,(.+)$/);
  const ext = matches ? matches[1] : 'png';
  const data = matches ? matches[2] : base64String;
  const filename = `${crypto.randomUUID()}.${ext}`;
  const filePath = path.join(subDir, filename);
  fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
  const relativePath = `/uploads/${folder}/${filename}`;
  return { secure_url: relativePath };
};

const uploadDocumentToCloudinary = (buffer, folder = 'techserv') => {
  if (useCloudinary) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto' },
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      stream.end(buffer);
    });
  }

  const subDir = path.join(UPLOADS_DIR, folder.replace(/\//g, path.sep));
  ensureDir(subDir);
  const filename = `${crypto.randomUUID()}.pdf`;
  const filePath = path.join(subDir, filename);
  fs.writeFileSync(filePath, buffer);
  return Promise.resolve({ secure_url: `/uploads/${folder}/${filename}` });
};

const deleteFromCloudinary = async (url) => {
  if (useCloudinary && cloudinary) {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
    if (match) await cloudinary.uploader.destroy(match[1]);
  } else {
    const filePath = path.join(UPLOADS_DIR, url.replace(/^\/uploads\//, '').replace(/\//g, path.sep));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
};

module.exports = { cloudinary, uploadToCloudinary, uploadDocumentToCloudinary, uploadBase64ToCloudinary, deleteFromCloudinary };
