# Certificado de prueba de Llama.pe

Esta versión ya incluye la carga de certificados en Configuración fiscal.

1. Selecciona SUNAT directo y el ambiente Beta / pruebas.
2. Utiliza en los comprobantes el mismo RUC con el que generaste el certificado.
3. En Certificado digital, selecciona el archivo .pfx descargado.
4. Escribe la contraseña que elegiste en Llama.pe y guarda la configuración.
5. Comprueba que se muestre el nombre del certificado guardado.

El archivo y su contraseña se cargan desde la aplicación; no se incluyen en Git.
Configura FISCAL_CREDENTIALS_ENCRYPTION_KEY en el servidor y en la función
emitir-factura con el mismo valor privado, como indica .env.example.

Un certificado de demostración no sirve para producción. Guardarlo en la
aplicación no confirma que la emisión o la recepción de CDR hayan funcionado.
Es necesario realizar una prueba completa en Beta.
