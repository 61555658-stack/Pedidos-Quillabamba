package pe.quillayaa.pruebas;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.OutputStream;
import java.util.Arrays;

/** Test-only Android host. All account and business data stays on the web server. */
public final class MainActivity extends Activity {
    private static final int PICK_FILE = 10, SAVE_PDF = 11, CAMERA = 12, LOCATION = 13;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest cameraRequest;
    private GeolocationPermissions.Callback locationCallback;
    private String locationOrigin;
    private byte[] pendingPdf;
    private boolean errorShown;

    private boolean trusted(String value) {
        if (value == null) return false;
        Uri uri = Uri.parse(value), home = Uri.parse(BuildConfig.HOME_URL);
        return "https".equals(uri.getScheme())
            && home.getHost().equals(uri.getHost()) && uri.getPort() == home.getPort();
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(0xfffaf8f4);
        setContentView(web);
        // Keep content below system bars on Android 15 and above.
        web.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setGeolocationEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.addJavascriptInterface(new PdfBridge(), "QuillayaaFiles");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (trusted(url)) return false;
                if (!request.isForMainFrame()) return true;
                openExternal(request.getUrl());
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                errorShown = false;
                CookieManager.getInstance().flush();
                if (!trusted(url)) return;
                // The web report uses blob URLs; hand PDF downloads to Android's save dialog.
                view.evaluateJavascript("(function(){if(window.__quillayaaPdf)return;"
                    + "window.__quillayaaPdf=true;var click=HTMLAnchorElement.prototype.click;"
                    + "HTMLAnchorElement.prototype.click=function(){var a=this;"
                    + "if(a.href.startsWith('blob:')&&a.download.toLowerCase().endsWith('.pdf')){"
                    + "fetch(a.href).then(r=>r.blob()).then(b=>{if(b.size>20971520)throw Error('PDF demasiado grande');"
                    + "var reader=new FileReader();reader.onload=function(){QuillayaaFiles.savePdf("
                    + "String(reader.result).split(',')[1],a.download)};reader.readAsDataURL(b);})"
                    + ".catch(()=>alert('No se pudo guardar el PDF. Intenta nuevamente.'));return;}"
                    + "return click.call(this);};})()", null);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && !errorShown && !isFinishing()) {
                    errorShown = true;
                    new AlertDialog.Builder(MainActivity.this).setTitle("No se pudo conectar")
                        .setMessage("Este APK de prueba necesita internet y que el proyecto de Replit esté activo.")
                        .setPositiveButton("Reintentar", (d, which) -> web.loadUrl(BuildConfig.HOME_URL))
                        .setNegativeButton("Cerrar", (d, which) -> finish()).show();
                }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (!trusted(view.getUrl())) { callback.onReceiveValue(null); return true; }
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                try { startActivityForResult(intent, PICK_FILE); }
                catch (Exception e) { callback.onReceiveValue(null); fileCallback = null; }
                return true;
            }
            @Override public void onPermissionRequest(PermissionRequest request) {
                if (!trusted(request.getOrigin().toString())
                    || !Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                    request.deny(); return;
                }
                if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                } else {
                    if (cameraRequest != null) cameraRequest.deny();
                    cameraRequest = request;
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA);
                }
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                if (cameraRequest == request) cameraRequest = null;
            }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (!trusted(origin)) { callback.invoke(origin, false, false); return; }
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                    || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false);
                } else {
                    if (locationCallback != null) locationCallback.invoke(locationOrigin, false, false);
                    locationOrigin = origin; locationCallback = callback;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION);
                }
            }
            @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean gesture, android.os.Message message) {
                if (!gesture) return false;
                WebView popup = new WebView(MainActivity.this);
                popup.setWebViewClient(new WebViewClient() {
                    @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                        String url = request.getUrl().toString();
                        if (trusted(url)) web.loadUrl(url); else openExternal(request.getUrl());
                        popup.destroy();
                        return true;
                    }
                });
                ((WebView.WebViewTransport) message.obj).setWebView(popup);
                message.sendToTarget();
                return true;
            }
        });
        web.setDownloadListener((url, agent, disposition, mime, size) -> {
            if (!trusted(url)) {
                Toast.makeText(this, "Descarga no disponible.", Toast.LENGTH_LONG).show();
                return;
            }
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            String cookie = CookieManager.getInstance().getCookie(url);
            if (cookie != null) request.addRequestHeader("Cookie", cookie);
            request.addRequestHeader("User-Agent", agent);
            request.setMimeType(mime);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,
                safeName(URLUtil.guessFileName(url, disposition, mime)));
            try {
                ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(request);
                Toast.makeText(this, "Descarga iniciada.", Toast.LENGTH_SHORT).show();
            } catch (Exception e) { Toast.makeText(this, "No se pudo descargar.", Toast.LENGTH_LONG).show(); }
        });
        if (state == null || web.restoreState(state) == null) web.loadUrl(BuildConfig.HOME_URL);
    }

    private String safeName(String name) {
        String clean = name == null ? "archivo" : name.replaceAll("[^a-zA-Z0-9._-]", "_");
        return clean.substring(0, Math.min(clean.length(), 120));
    }

    private void openExternal(Uri uri) {
        String scheme = uri.getScheme();
        if (!"https".equals(scheme) && !"tel".equals(scheme) && !"mailto".equals(scheme) && !"geo".equals(scheme)) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (Exception e) { Toast.makeText(this, "No hay una aplicación para abrir este enlace.", Toast.LENGTH_SHORT).show(); }
    }

    private final class PdfBridge {
        @JavascriptInterface public void savePdf(String encoded, String name) {
            if (encoded == null || encoded.length() > 28_000_000) return;
            try {
                byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
                if (bytes.length < 5 || bytes[0] != '%' || bytes[1] != 'P'
                    || bytes[2] != 'D' || bytes[3] != 'F' || bytes[4] != '-') return;
                runOnUiThread(() -> {
                    if (!trusted(web.getUrl()) || isFinishing()) return;
                    if (pendingPdf != null) {
                        Toast.makeText(MainActivity.this, "Termina de guardar el PDF anterior.", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    pendingPdf = bytes;
                    String filename = safeName(name);
                    if (!filename.toLowerCase().endsWith(".pdf")) filename += ".pdf";
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                        .addCategory(Intent.CATEGORY_OPENABLE).setType("application/pdf")
                        .putExtra(Intent.EXTRA_TITLE, filename);
                    try { startActivityForResult(intent, SAVE_PDF); }
                    catch (Exception e) {
                        pendingPdf = null;
                        Toast.makeText(MainActivity.this, "No se pudo abrir el guardado del PDF.", Toast.LENGTH_LONG).show();
                    }
                });
            } catch (IllegalArgumentException ignored) { /* Ignore invalid bridge input. */ }
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(result == RESULT_OK && data != null && data.getData() != null
                ? new Uri[]{data.getData()} : null);
            fileCallback = null;
        }
        if (request == SAVE_PDF) {
            if (pendingPdf != null && result == RESULT_OK && data != null && data.getData() != null) {
                try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
                    if (output == null) throw new java.io.IOException("Destino no disponible");
                    output.write(pendingPdf);
                    Toast.makeText(this, "PDF guardado.", Toast.LENGTH_SHORT).show();
                } catch (Exception e) { Toast.makeText(this, "No se pudo guardar el PDF.", Toast.LENGTH_LONG).show(); }
            }
            pendingPdf = null;
        }
    }

    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(request, permissions, grants);
        if (request == CAMERA && cameraRequest != null) {
            if (grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED)
                cameraRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            else cameraRequest.deny();
            cameraRequest = null;
        }
        if (request == LOCATION && locationCallback != null) {
            boolean allowed = false;
            for (int grant : grants) if (grant == PackageManager.PERMISSION_GRANTED) allowed = true;
            locationCallback.invoke(locationOrigin, allowed, false);
            locationCallback = null;
        }
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        web.saveState(state);
        super.onSaveInstanceState(state);
    }
    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
    @Override protected void onPause() {
        CookieManager.getInstance().flush();
        web.onPause();
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        if (cameraRequest != null) cameraRequest.deny();
        if (locationCallback != null) locationCallback.invoke(locationOrigin, false, false);
        pendingPdf = null;
        web.removeJavascriptInterface("QuillayaaFiles");
        web.destroy();
        super.onDestroy();
    }
}
