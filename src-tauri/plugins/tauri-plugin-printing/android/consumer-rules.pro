# Reglas que viajan con el módulo cuando la app minifica (R8).
#
# Tauri instancia la clase del plugin por reflexión desde Rust (JNI, por nombre) y despacha los
# `@Command` por *nombre de método*; R8 no puede ver ninguno de los dos usos y los borraría.
-keep class app.piru.printing.PrintingPlugin { *; }
-keepclassmembers class app.piru.printing.** {
    @app.tauri.annotation.Command <methods>;
    @app.tauri.annotation.PermissionCallback <methods>;
    @app.tauri.annotation.ActivityCallback <methods>;
}
