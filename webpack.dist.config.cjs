const path = require('path');
const fs = require('fs');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { execSync } = require('child_process');

module.exports = {
    mode: 'production',
    entry: {
        'geoline.ol': [
            path.resolve(__dirname, 'src/geoline.ol.js'),
            path.resolve(__dirname, 'src/geoline.ol.css')
        ],
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        clean: {},
    },
    resolve: {
        extensions: ['.js', '.css'],
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    {
                        loader: 'css-loader',
                        options: {
                            import: true,     // @import verarbeiten
                            url: false,       // URLs nicht verarbeiten
                            sourceMap: true,  // Source Maps für CSS
                        }
                    }
                ],
            },
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: '[name].css',
        }),

        // Nach Build die Version im erzeugten JS ersetzen
        {
            apply: (compiler) => {
                compiler.hooks.done.tap('ReplaceVersionInDistJs', () => {
                    const outFile = path.resolve(__dirname, 'dist/geoline.ol.js');
                    if (fs.existsSync(outFile)) {
                        try {
                            execSync("npx cross-var replace '@version@' '$npm_package_version' 'dist/geoline.ol.js'", { stdio: 'inherit', shell: true });
                        } catch (e) {
                            console.error('Fehler beim Ersetzen der Version in dist JS:', e?.message || e);
                        }
                    }
                });
            }
        },
    ],
    optimization: {
        minimizer: [
            `...`, // Behält die Standard JS-Minifier (Terser)
            new CssMinimizerPlugin({
                minimizerOptions: {
                    preset: [
                        'default',
                        {
                            discardComments: { removeAll: true }, // Alle Kommentare entfernen
                            normalizeWhitespace: true,            // Whitespace normalisieren
                            mergeLonghand: true,                  // Longhand-Properties zusammenführen
                            mergeRules: true,                     // Ähnliche Regeln zusammenführen
                        },
                    ],
                },
            }),
        ],
    },
    devtool: 'source-map',
};
