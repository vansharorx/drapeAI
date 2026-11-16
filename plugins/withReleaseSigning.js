const { withAndroidColors, withAndroidStyles, withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

/** Keep release signing out of the debug key across Expo prebuilds. */
module.exports = function withReleaseSigning(config) {
  config = withAndroidColors(config, (config) => {
    const colors = config.modResults.resources.color ?? (config.modResults.resources.color = []);
    const splash = colors.find((entry) => entry.$?.name === 'splashscreen_background');
    if (splash) splash._ = '#0B0B0B';
    else colors.push({ $: { name: 'splashscreen_background' }, _: '#0B0B0B' });
    return config;
  });

  config = withAndroidStyles(config, (config) => {
    const styles = config.modResults.resources.style ?? (config.modResults.resources.style = []);
    const splashTheme = styles.find((entry) => entry.$?.name === 'Theme.App.SplashScreen');
    if (splashTheme) {
      const items = splashTheme.item ?? (splashTheme.item = []);
      const background = items.find((entry) => entry.$?.name === 'android:windowBackground');
      if (background) background._ = '@color/splashscreen_background';
      else items.push({ $: { name: 'android:windowBackground' }, _: '@color/splashscreen_background' });
    }
    return config;
  });

  config = withGradleProperties(config, (config) => {
    const properties = config.modResults;
    const architectures = properties.find((entry) => entry.type === 'property' && entry.key === 'reactNativeArchitectures');
    if (architectures) architectures.value = 'arm64-v8a';
    else properties.push({ type: 'property', key: 'reactNativeArchitectures', value: 'arm64-v8a' });
    return config;
  });

  return withAppBuildGradle(config, (config) => {
    let source = config.modResults.contents;
    if (source.includes('DRAPEAI_RELEASE_STORE_FILE')) {
      if (!source.includes('debuggableVariants = []')) {
        source = source.replace(/(bundleCommand = "export:embed"\n)/, '$1    debuggableVariants = []\n');
      }
      config.modResults.contents = source;
      return config;
    }

    const signingProperties = `def releaseStoreFile = findProperty('DRAPEAI_RELEASE_STORE_FILE') ?: System.getenv('DRAPEAI_RELEASE_STORE_FILE')
def releaseStorePassword = findProperty('DRAPEAI_RELEASE_STORE_PASSWORD') ?: System.getenv('DRAPEAI_RELEASE_STORE_PASSWORD')
def releaseKeyAlias = findProperty('DRAPEAI_RELEASE_KEY_ALIAS') ?: System.getenv('DRAPEAI_RELEASE_KEY_ALIAS')
def releaseKeyPassword = findProperty('DRAPEAI_RELEASE_KEY_PASSWORD') ?: System.getenv('DRAPEAI_RELEASE_KEY_PASSWORD')
def hasReleaseSigning = [releaseStoreFile, releaseStorePassword, releaseKeyAlias, releaseKeyPassword].every { it }
`;
    source = source.replace(/^(def jscFlavor = .*\n)/m, `$1${signingProperties}`);
    source = source.replace(/(bundleCommand = "export:embed"\n)/, '$1    debuggableVariants = []\n');
    source = source.replace(/(        versionName "[^"]+"\n)/, `$1\n        // Keep generated CMake object paths short on Windows.\n        externalNativeBuild {\n            cmake {\n                arguments "-DCMAKE_OBJECT_PATH_MAX=240"\n            }\n        }\n`);

    const signingBlock = `    if (hasReleaseSigning) {
        signingConfigs {
            release {
                storeFile file(releaseStoreFile)
                storePassword releaseStorePassword
                keyAlias releaseKeyAlias
                keyPassword releaseKeyPassword
            }
        }
    }
`;
    source = source.replace(/(    buildTypes \{)/, `${signingBlock}$1`);

    const releaseStart = source.indexOf('        release {', source.indexOf('    buildTypes {'));
    if (releaseStart < 0) throw new Error('Could not find Android release build type for signing configuration.');
    const releaseEnd = source.indexOf('\n        }', releaseStart);
    const releaseBlock = source.slice(releaseStart, releaseEnd);
    if (!releaseBlock.includes('signingConfig')) throw new Error('Could not find release signing setting in Android Gradle file.');
    const securedBlock = releaseBlock.replace(/signingConfig\s+signingConfigs\.debug/, 'signingConfig hasReleaseSigning ? signingConfigs.release : null');
    source = source.slice(0, releaseStart) + securedBlock + source.slice(releaseEnd);

    config.modResults.contents = source;
    return config;
  });
};
