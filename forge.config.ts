import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import fs from 'fs';
import path from 'path';

const config: ForgeConfig = {
    packagerConfig: {
        asar: true,
        name: 'X-tools',
        executableName: 'X-tools',
        // 为不同平台设置不同的图标
        // Electron Packager will automatically select the appropriate icon file for each platform
        // based on the file extension (ico for Windows, icns for macOS, png for Linux)
        icon: path.resolve(__dirname, 'public/icon'),
        extraResource: [
            path.join(__dirname, 'public/pdfjs'),
        ],
        // Windows特定配置：隐藏控制台窗口
        win32metadata: {
            CompanyName: 'X-tools',
            FileDescription: 'X-tools',
            OriginalFilename: 'X-tools.exe',
            ProductName: 'X-tools',
            InternalName: 'X-tools',
            // 隐藏控制台窗口
            "requested-execution-level": "asInvoker"
        }
    },
    rebuildConfig: {},
    hooks: {
        postMake: async (forgeConfig, makeResults) => {
            /* 在这里我们可以重命名生成的文件 */

            // 复制文件的通用函数，保留原始文件并创建新名称的副本
            const copyArtifactWithNewName = (artifact: string, searchValue: string, replaceValue: string) => {
                // 获取文件名
                const basename = path.basename(artifact);
                // 创建新的文件路径，保持目录结构一致
                const newBasename = basename.replace(searchValue, replaceValue);

                // 确保 out 目录存在
                const outDir = path.join(process.cwd(), 'out');
                if (!fs.existsSync(outDir)) {
                    fs.mkdirSync(outDir, { recursive: true });
                }

                // 复制文件到 out 目录并使用新名称
                const finalPath = path.join(outDir, newBasename);
                try {
                    // 复制文件而不是重命名，保留原始工件
                    fs.copyFileSync(artifact, finalPath);
                    console.log(`Copied ${artifact} to ${finalPath}`);
                } catch (error) {
                    console.error(`Failed to copy ${artifact}:`, error);
                }
            };

            for (const makeResult of makeResults) {
                for (const artifact of makeResult.artifacts) {
                    if (artifact.includes('darwin')) {
                        copyArtifactWithNewName(artifact, 'darwin', 'macos');
                    } else if (artifact.includes('win32')) {
                        copyArtifactWithNewName(artifact, 'win32', 'windows');
                    }
                }
            }
        }
    },
    makers: [
        // new MakerSquirrel({}),
        new MakerZIP({}, ['darwin', 'win32']),
        // new MakerRpm({}),
        // new MakerDeb({}),
    ],
    plugins: [
        new VitePlugin({
            // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
            // If you are familiar with Vite configuration, it will look really familiar.
            build: [
                {
                    // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
                    entry: 'src/main.ts',
                    config: 'vite.main.config.ts',
                    target: 'main',
                },
                {
                    entry: 'src/preload.ts',
                    config: 'vite.preload.config.ts',
                    target: 'preload',
                },
            ],
            renderer: [
                {
                    name: 'main_window',
                    config: 'vite.renderer.config.ts',
                },
            ],
        }),
        // Fuses are used to enable/disable various Electron functionality
        // at package time, before code signing the application
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
        }),
    ],
};

export default config;