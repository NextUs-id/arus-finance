package com.arus.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {

    private WebView web;
    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER_REQ = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage — inti Arus
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView wv, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = cb;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER_REQ);
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "ArusBridge");
        web.loadUrl("file:///android_asset/index.html");
        setContentView(web);

        // storage probe: kalau localStorage gagal, Arus sudah punya toast sendiri,
        // tapi kita pastikan WebView tidak error di layar
        try {
            web.evaluateJavascript("localStorage.setItem('__probe','1'); localStorage.removeItem('__probe');", null);
        } catch (Exception e) {
            Toast.makeText(this, "Penyimpanan tidak tersedia di perangkat ini", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQ) {
            if (filePathCallback == null) { super.onActivityResult(requestCode, resultCode, data); return; }
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getDataString() != null) {
                    results = new Uri[] { Uri.parse(data.getDataString()) };
                } else if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    results = new Uri[n];
                    for (int i = 0; i < n; i++) results[i] = data.getClipData().getItemAt(i).getUri();
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    private class Bridge {
        @JavascriptInterface
        public void saveExport(String fileName, String content) {
            try {
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                    cv.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
                    cv.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (uri == null) throw new Exception("insert gagal");
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    os.write(content.getBytes("UTF-8"));
                    os.close();
                } else {
                    File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (dir != null && (dir.exists() || dir.mkdirs())) {
                        File f = new File(dir, fileName);
                        FileOutputStream fos = new FileOutputStream(f);
                        fos.write(content.getBytes("UTF-8"));
                        fos.close();
                    } else throw new Exception("folder Downloads tak tersedia");
                }
                runOnUiThread(new Runnable() { public void run() { Toast.makeText(MainActivity.this, "Backup tersimpan di folder Downloads", Toast.LENGTH_LONG).show(); } });
            } catch (Exception e) {
                runOnUiThread(new Runnable() { public void run() { Toast.makeText(MainActivity.this, "Gagal menyimpan backup", Toast.LENGTH_LONG).show(); } });
            }
        }
        @JavascriptInterface
        public void shareExport(String fileName, String content) {
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("application/json");
            send.putExtra(Intent.EXTRA_SUBJECT, fileName);
            send.putExtra(Intent.EXTRA_TEXT, content);
            runOnUiThread(new Runnable() { public void run() { startActivity(Intent.createChooser(send, "Bagikan backup Arus")); } });
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Arus autosave saat pagehide; panggil JS save sebagai pengaman ekstra
        if (web != null) {
            try {
                web.evaluateJavascript("window.__arusSave && window.__arusSave();", null);
            } catch (Exception ignored) {}
        }
    }
}
