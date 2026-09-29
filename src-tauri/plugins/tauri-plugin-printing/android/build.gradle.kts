// Módulo Gradle del plugin. Lo incluye la app automáticamente: el build script de la app
// (`tauri-build`) lee `DEP_TAURI_PLUGIN_PRINTING_ANDROID_LIBRARY_PATH`, que emite el build.rs de
// este crate, y escribe el `include ':tauri-plugin-printing'` en `gen/android/tauri.settings.gradle`
// más el `implementation(project(":tauri-plugin-printing"))` en `app/tauri.build.gradle.kts`.
// Si las clases Kotlin no aparecen en el APK, el primer lugar donde mirar es esa variable.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    // Namespace propio: las clases quedan en `app.piru.printing`, separadas de las de la app
    // (`app.piru.admin`). Es el paquete que declara `register_android_plugin` en Rust.
    namespace = "app.piru.printing"
    compileSdk = 36

    defaultConfig {
        // Mismo mínimo que la app: Android 7.
        minSdk = 24
        consumerProguardFiles("consumer-rules.pro")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    // Igual que el módulo de la app: si el target de Java y el de Kotlin no coinciden, AGP 8 falla
    // con "Inconsistent JVM-target compatibility".
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
}

dependencies {
    // La librería de Tauri: de acá salen `app.tauri.plugin.Plugin`, `Invoke` y las anotaciones.
    // El proyecto `:tauri-android` lo incluye el settings.gradle de la app (generado).
    implementation(project(":tauri-android"))
    // Sin androidx a propósito: el único lugar donde haría falta (`ContextCompat.registerReceiver`,
    // porque Android 14 exige declarar si el receptor está exportado) se resuelve con
    // `registerReceiver(receptor, filtro, Context.RECEIVER_NOT_EXPORTED)`, que existe en el SDK
    // desde API 33. Una dependencia menos que arrastrar y que resolver en el build offline.
}
