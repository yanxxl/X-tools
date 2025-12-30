#!/usr/bin/env node

/**
 * 生成包含多个尺寸的 Windows ICO 文件
 * 使用 ImageMagick 或在线转换工具
 * 
 * 使用方法:
 * node scripts/generate-windows-icon.js
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function generateWindowsIcon() {
  try {
    const inputPath = path.join(__dirname, '..', 'public', 'icon.png');
    const outputPath = path.join(__dirname, '..', 'public', 'icon.ico');
    
    if (!fs.existsSync(inputPath)) {
      console.error('❌ 找不到原始图标文件:', inputPath);
      process.exit(1);
    }

    console.log('🔄 开始生成 Windows ICO 图标...');

    // 检查是否安装了 ImageMagick
    try {
      execSync('magick -version', { stdio: 'ignore' });
      console.log('✅ 检测到 ImageMagick，使用 ImageMagick 生成 ICO 文件');
      
      // 使用 ImageMagick 生成包含多个尺寸的 ICO 文件
      const sizes = [16, 24, 32, 48, 64, 128, 256];
      const sizeArgs = sizes.map(size => `\( -clone 0 -resize ${size}x${size} \)`).join(' ');
      
      const command = `magick "${inputPath}" ${sizeArgs} -delete 0 -alpha on -background none "${outputPath}"`;
      execSync(command, { stdio: 'inherit' });
      
      console.log('✅ Windows ICO 文件已生成（包含多个尺寸）');
      
    } catch (error) {
      console.log('⚠️  ImageMagick 不可用，使用简单的 sharp 方法');
      
      // 使用 sharp 生成单个尺寸的 ICO 文件（作为临时解决方案）
      const sharp = require('sharp');
      
      // 生成 256x256 尺寸的 ICO 文件
      await sharp(inputPath)
        .resize(256, 256)
        .toFile(outputPath);
      
      console.log('✅ 已生成 256x256 尺寸的 ICO 文件');
      console.log('💡 建议安装 ImageMagick 以获得更好的多尺寸支持');
    }

    console.log('🎉 Windows 图标生成完成！');
    
  } catch (error) {
    console.error('❌ 生成 Windows ICO 图标时出错:', error);
    process.exit(1);
  }
}

// 运行函数
generateWindowsIcon();