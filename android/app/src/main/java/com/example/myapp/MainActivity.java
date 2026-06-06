package com.example.myapp;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.Window;
import android.view.WindowManager;

public class MainActivity extends Activity {
    private WebView myWebView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Remove title bar and make app fullscreen
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        
        // Initialize WebView programmatically for cleaner layout
        myWebView = new WebView(this);
        
        WebSettings webSettings = myWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true); // Enabled local storage
        webSettings.setAllowFileAccess(true); // Enabled local asset files
        webSettings.setAllowContentAccess(true);
        webSettings.setDatabaseEnabled(true);
        
        // Prevent launching external browser on links click
        myWebView.setWebViewClient(new WebViewClient());
        
        // Load the local bundled web frontend assets
        myWebView.loadUrl("file:///android_asset/www/index.html");
        
        setContentView(myWebView);
    }

    // Capture physical Android back button presses to navigate web history
    @Override
    public void onBackPressed() {
        if (myWebView != null && myWebView.canGoBack()) {
            myWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
