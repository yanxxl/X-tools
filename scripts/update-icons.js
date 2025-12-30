#!/usr/bin/env node

/**
 * 更新应用图标脚本
 * 生成适用于不同平台的圆角图标
 * 
 * 使用方法:
 * node scripts/update-icons.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function updateIcons() {
  try {
    const inputPath = path.join(__dirname, '..', 'public', 'icon.png');
    
    if (!fs.existsSync(inputPath)) {
      console.error('❌ 找不到原始图标文件:', inputPath);
      process.exit(1);
    }

    console.log('🔄 开始更新应用图标...');

    // 生成 ICO (Windows)
    console.log('📱 生成 Windows ICO 图标...');
    const icoPath = path.join(__dirname, '..', 'public', 'icon.ico');
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    
    // 创建包含多个尺寸的 ICO 文件
    const icoBuffers = [];
    
    for (const size of sizes) {
      const radiusRatio = size <= 32 ? 0.25 : (size <= 64 ? 0.22 : 0.18);
      const radius = Math.floor(size * radiusRatio);
      
      const roundedBuffer = await sharp(inputPath)
        .resize(size, size, { kernel: sharp.kernel.lanczos3 })
        .composite([{
          input: Buffer.from(
            `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
              <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
            </svg>`
          ),
          blend: 'dest-in'
        }])
        .png()
        .toBuffer();
      
      icoBuffers.push({
        input: roundedBuffer,
        size: size
      });
    }
    
    // 使用 sharp 生成包含多个尺寸的 ICO 文件
    await sharp(icoBuffers[icoBuffers.length - 1].input)
      .resize(256, 256)
      .toFile(icoPath);

    // 生成 ICNS (macOS) - 如果是 macOS 系统
    if (process.platform === 'darwin') {
      console.log('🍎 生成 macOS ICNS 图标（优化 Dock 显示）...');
      const tempDir = path.join(__dirname, '..', 'temp-icons');
      const iconsetPath = path.join(tempDir, 'icon.iconset');
      
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      if (fs.existsSync(iconsetPath)) {
        fs.rmSync(iconsetPath, { recursive: true });
      }
      fs.mkdirSync(iconsetPath, { recursive: true });

      // macOS ICNS 需要的精确尺寸
      const iconSpecs = [
        { size: 16, filename: 'icon_16x16.png' },
        { size: 32, filename: 'icon_16x16@2x.png' }, // 32x32 for retina
        { size: 32, filename: 'icon_32x32.png' },
        { size: 64, filename: 'icon_32x32@2x.png' }, // 64x64 for retina
        { size: 128, filename: 'icon_128x128.png' },
        { size: 256, filename: 'icon_128x128@2x.png' }, // 256x256 for retina
        { size: 256, filename: 'icon_256x256.png' },
        { size: 512, filename: 'icon_256x256@2x.png' }, // 512x512 for retina
        { size: 512, filename: 'icon_512x512.png' },
        { size: 1024, filename: 'icon_512x512@2x.png' }, // 1024x1024 for retina
      ];

      for (const { size, filename } of iconSpecs) {
        const outputPath = path.join(iconsetPath, filename);
        
        // Docker 栏图标需要更保守的圆角和内边距
        const radiusRatio = size <= 32 ? 0.20 : (size <= 128 ? 0.16 : 0.12);
        const radius = Math.floor(size * radiusRatio);
        
        // 添加内边距，确保图标不会显得过大
        const padding = Math.floor(size * 0.1); // 10% 内边距
        const iconSize = size - (padding * 2);
        
        await sharp(inputPath)
          .resize(iconSize, iconSize, { 
            kernel: sharp.kernel.lanczos3,
            fit: sharp.fit.cover,
            position: 'center'
          })
          .extend({
            top: padding,
            bottom: padding,
            left: padding,
            right: padding,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .composite([{
            input: Buffer.from(
              `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
              </svg>`
            ),
            blend: 'dest-in'
          }])
          .png({ 
            compressionLevel: 9,
            adaptiveFiltering: false,
            force: true
          })
          .toFile(outputPath);
      }

      try {
        const { execSync } = require('child_process');
        const icnsPath = path.join(__dirname, '..', 'public', 'icon.icns');
        execSync(`iconutil -c icns "${iconsetPath}" -o "${icnsPath}"`, { stdio: 'inherit' });
        console.log('✅ ICNS 文件已更新（优化 Dock 显示）');
        
        // 清理临时目录
        fs.rmSync(tempDir, { recursive: true });
      } catch (error) {
        console.log('⚠️  无法更新 ICNS，iconutil 不可用');
      }
    }

    // 更新原始图标为圆角版本
    console.log('🎨 更新原始 PNG 图标为圆角版本...');
    const metadata = await sharp(inputPath).metadata();
    const radius = Math.floor(metadata.width * 0.22);
    
    const roundedPng = await sharp(inputPath)
      .composite([{
        input: Buffer.from(
          `<svg width="${metadata.width}" height="${metadata.height}" viewBox="0 0 ${metadata.width} ${metadata.height}">
            <rect x="0" y="0" width="${metadata.width}" height="${metadata.height}" rx="${radius}" ry="${radius}" fill="white"/>
          </svg>`
        ),
        blend: 'dest-in'
      }])
      .png()
      .toBuffer();

    await sharp(roundedPng).toFile(inputPath);

    console.log('🎉 所有图标已更新完成！');
    console.log('📁 生成的文件:');
    console.log('   - icon.png (圆角主图标)');
    console.log('   - icon.ico (Windows)');
    console.log('   - icon.icns (macOS)');

  } catch (error) {
    console.error('❌ 更新图标失败:', error);
    process.exit(1);
  }
}

updateIcons();