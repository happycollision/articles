// @ts-nocheck

import path from "path"
import { DefinePlugin } from "webpack"
import MiniCssExtractPlugin from "mini-css-extract-plugin"
import HtmlWebpackPlugin from "html-webpack-plugin"

type WebpackEnv = {
  /** Webpack adds this boolean when running the dev server */
  WEBPACK_SERVE?: boolean

  /** This is the webpack env var that we're requiring from the CLI */
  variantName: string
}

const defaultVariantName = "public"
const dir = path.resolve(__dirname)

/**
 * This function can be replaced with anything that loads a particular
 * config based on a variant name. In our codebase, we load some fairly
 * intricate configuration files written in JavaScript. For simplicity
 * though, I've hard-coded some values directly.
 *
 * The comments inside each variant help explain the imaginary state I
 * am setting up, which is somewhat similar to what we use at Trilliant
 * Health. As I said, though, this part is completely up to you. You can
 * expose anything you want to your app via some kind of variant
 * configuration, coupled with-in the case of Webpack-the
 * `WebpackDefinePlugin`.
 */
function getVariantConfig(variantName: string) {
  const variants = [
    {
      // This is what I'd consider the "production" version of the app.
      // I call it public here because I don't want to confuse it with
      // the Node environment name.
      name: "public",
      buildConfig: {
        apiBaseUrl: "https://api.example.com",
        auth0Audience: "http://stable-example.com/api",
        auth0ClientId: "A92H...",
        auth0Domain: "your-account.us.auth0.com",
        mockServer: false,
      },
    },
    {
      // In this imaginary scenario, the mock server handles everything,
      // so we don't need to provide a real server URL
      name: "mock",
      buildConfig: {
        apiBaseUrl: "https://api-does-not-exist.example.com",
        auth0Audience: "http://stable-example.com/api",
        auth0ClientId: "A92H...",
        auth0Domain: "your-account.us.auth0.com",
        mockServer: true,
      },
    },
    {
      // Let's say that local development for the new feature is faster
      // with a mock server. So for this variant, we are working on some
      // new feature, but using our mock server to do so.
      name: "my_new_feature_local",
      buildConfig: {
        apiBaseUrl: "https://api-feature-branch.example.com",
        auth0Audience: "http://experimental-example.com/api",
        auth0ClientId: "B93I...",
        auth0Domain: "your-feature-account.us.auth0.com",
        mockServer: true,
      },
    },
    {
      // This variant is fully integrated end-to-end, so we
      // don't use the mock server. We can push this version up to the
      // server to let our teammates see how work is progressing and how
      // the actual new server endpoints are working.
      name: "my_new_feature",
      buildConfig: {
        apiBaseUrl: "https://api-feature-branch.example.com",
        auth0Audience: "http://experimental-example.com/api",
        auth0ClientId: "B93I...",
        auth0Domain: "your-feature-account.us.auth0.com",
        mockServer: false,
      },
    },
  ]

  const variant = variants.find((x) => x.name === variantName)
  if (!variant)
    throw new Error("No variant found called " + variantName)

  return variant
}
/**
 * The Webpack config. Don't forget to specify a variant when you call
 * it from the CLI:
 *
 *   webpack --env variantName=public
 *
 */
export default async (webpackEnv: WebpackEnv) => {
  if (!webpackEnv.variantName)
    throw new Error("You must specify a `variantName`.")

  const variant = getVariantConfig(webpackEnv.variantName)
  const entry = [`${dir}/src/index.ts`]

  return {
    // An example of how a variant's config can be used to add a mock
    // server.
    entry: variant.buildConfig.mockServer
      ? [`${dir}/src/mockServer.ts`, ...entry]
      : entry,
    output: {
      // Fingerprint the image files
      assetModuleFilename: "assets/images/[contenthash][ext]",
      // Fingerprint the JS files
      filename: "assets/js/[name].[contenthash].js",
      path: "build",
      publicPath: "/",
    },
    //
    //
    // NOTE: I have left out all the usual loader and file type
    // configuration. It's up to you to merge the examples here with
    // your actual Webpack configuration.
    //
    //
    plugins: [
      new MiniCssExtractPlugin({
        // We want to fingerprint the CSS files, just like the JS files
        filename: "assets/css/[name].[contenthash].css",
      }),

      // Examples of using the variant config to change constants inside
      // the app
      new DefinePlugin({
        AUTH_0_AUDIENCE: JSON.stringify(
          variant.buildConfig.auth0Audience
        ),
        AUTH_0_CLIENT_ID: JSON.stringify(
          variant.buildConfig.auth0ClientId
        ),
        AUTH_0_DOMAIN: JSON.stringify(variant.buildConfig.auth0Domain),
        API_BASE_URL: JSON.stringify(variant.buildConfig.apiBaseUrl),
      }),

      // Creates the variant dependencies JSON file:
      // variants/{variantName}.json.
      //
      // The HtmlWebpackPlugin is really not meant for creating JSON
      // files, but it is situated perfectly in the build process for
      // this exact task. If you think about it, we are just replacing
      // the use of `HtmlWebpackPlugin` as a way to inject our
      // dependencies into "index.html" with the exact same files
      // enumerated in a JSON file.
      new HtmlWebpackPlugin({
        inject: false,
        minify: false,
        templateParameters: (_compilation, assets, _tags, _opts) => ({
          assets,
        }),
        templateContent: `{
          "css": <%= JSON.stringify(assets.css) %>,
          "scripts": <%= JSON.stringify(assets.js) %>,
        }`,

        // When running locally for development, we just use the default
        // variant name as the name of the JSON file. The specified
        // variant's settings will still be loaded, but you won't have
        // to include a variant in your query params just for local
        // development. (Remember, no variant is the same as loading the
        // default variant. See the JavaScript in the index.html file)
        filename: `variants/${
          webpackEnv.WEBPACK_SERVE ? defaultVariantName : variant.name
        }.json`,
      }),
    ],
  }
}
