/**
 * Document Scanner Utility
 * Converts uploaded images to scanned black & white appearance
 * Uses Sharp library for image processing
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Convert an image to black & white scanned appearance
 * @param {string} inputPath - Path to the input image
 * @param {string} outputPath - Path where processed image will be saved
 * @param {object} options - Processing options
 * @returns {Promise<object>} - Processing result with file info
 */
async function convertToScannedDocument(inputPath, outputPath, options = {}) {
    try {
        const {
            brightness = 1.1,      // Slightly increase brightness
            contrast = 1.3,        // Increase contrast for text clarity
            threshold = 128,       // Threshold for black & white conversion
            quality = 90,          // JPEG quality
            dpi = 300             // DPI for scanned appearance
        } = options;

        // Get input file stats
        const inputStats = fs.statSync(inputPath);
        const inputExt = path.extname(inputPath).toLowerCase();

        // Process the image
        let pipeline = sharp(inputPath)
            .rotate() // Auto-rotate based on EXIF orientation
            .resize(null, null, {
                withoutEnlargement: true,
                fit: 'inside'
            });

        // Convert to grayscale
        pipeline = pipeline.grayscale();

        // Adjust brightness and contrast
        pipeline = pipeline.linear(contrast, -(128 * contrast) + 128 + (brightness * 50));

        // Apply threshold for black & white effect
        pipeline = pipeline.threshold(threshold);

        // Normalize to improve text clarity
        pipeline = pipeline.normalize();

        // Sharpen for crisp text
        pipeline = pipeline.sharpen({
            sigma: 1.5,
            m1: 0.5,
            m2: 0.5,
            x1: 2,
            y1: 10
        });

        // Set output format and quality
        const outputExt = path.extname(outputPath).toLowerCase();
        if (outputExt === '.png') {
            pipeline = pipeline.png({ quality: 90, compressionLevel: 9 });
        } else {
            pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        }

        // Set DPI metadata
        pipeline = pipeline.withMetadata({
            density: dpi
        });

        // Save processed image
        await pipeline.toFile(outputPath);

        // Get output file stats
        const outputStats = fs.statSync(outputPath);

        return {
            success: true,
            inputPath,
            outputPath,
            inputSize: inputStats.size,
            outputSize: outputStats.size,
            compressionRatio: ((1 - outputStats.size / inputStats.size) * 100).toFixed(2) + '%',
            message: 'Image successfully converted to scanned B&W format'
        };

    } catch (error) {
        console.error('Error converting image to scanned format:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Process multiple images for scanning
 * @param {Array<string>} inputPaths - Array of input image paths
 * @param {string} outputDir - Directory where processed images will be saved
 * @param {object} options - Processing options
 * @returns {Promise<Array<object>>} - Array of processing results
 */
async function batchProcessDocuments(inputPaths, outputDir, options = {}) {
    const results = [];

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const inputPath of inputPaths) {
        const fileName = path.basename(inputPath);
        const outputPath = path.join(outputDir, fileName);

        const result = await convertToScannedDocument(inputPath, outputPath, options);
        results.push({
            fileName,
            ...result
        });
    }

    return results;
}

/**
 * Check if a file is an image that can be processed
 * @param {string} filePath - Path to the file
 * @returns {boolean} - True if file is a processable image
 */
function isProcessableImage(filePath) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.webp'];
    const ext = path.extname(filePath).toLowerCase();
    return imageExtensions.includes(ext);
}

/**
 * Convert uploaded document to scanned format if it's an image
 * @param {string} filePath - Path to the uploaded file
 * @param {object} options - Processing options
 * @returns {Promise<object>} - Processing result
 */
async function processUploadedDocument(filePath, options = {}) {
    if (!isProcessableImage(filePath)) {
        return {
            success: true,
            skipped: true,
            message: 'File is not an image, no processing needed',
            filePath
        };
    }

    // Process in-place by creating temp file and replacing
    const tempPath = filePath + '.temp';
    
    try {
        const result = await convertToScannedDocument(filePath, tempPath, options);
        
        if (result.success) {
            // Replace original with processed version
            fs.unlinkSync(filePath);
            fs.renameSync(tempPath, filePath);
            
            return {
                ...result,
                filePath,
                message: 'Image successfully processed to scanned B&W format'
            };
        } else {
            // Clean up temp file if processing failed
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
            return result;
        }
    } catch (error) {
        // Clean up temp file on error
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
        throw error;
    }
}

module.exports = {
    convertToScannedDocument,
    batchProcessDocuments,
    isProcessableImage,
    processUploadedDocument
};
