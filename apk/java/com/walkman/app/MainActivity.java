package com.walkman.app;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.Manifest;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Walkman Android wrapper.
 * Loads the Walkman web app in a full WebView, connecting to the official
 * server (https://walkman.space-z.ai) out of the box. An alternate server can
 * be set from the error screen ("Change server"). A foreground service keeps
 * music playing with the screen off (driven by the WalkmanAndroid JS bridge).
 * Downloads go through the system DownloadManager, external links open in the
 * browser, and the back button walks WebView history.
 */
public class MainActivity extends Activity {

    private static final String PREFS = "walkman";
    private static final String KEY_SERVER = "server";

    /** Production Walkman server — used out of the box, no setup required. */
    private static final String DEFAULT_SERVER = "https://walkman.space-z.ai";

    private WebView web;
    private String serverUrl = "";
    private boolean webVisible = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);

        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        serverUrl = prefs.getString(KEY_SERVER, "");
        if (serverUrl.length() == 0) {
            // first launch: connect straight to the official Walkman server
            serverUrl = DEFAULT_SERVER;
            prefs.edit().putString(KEY_SERVER, serverUrl).apply();
            openPlayer(serverUrl);
        } else {
            openPlayer(serverUrl);
        }

        // media notification needs the notification permission on Android 13+
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{ Manifest.permission.POST_NOTIFICATIONS }, 100);
        }
    }

    /** Bridge the web app calls so the native foreground service follows playback. */
    private class Bridge {
        @JavascriptInterface
        public void onPlaying(String title, String artist, String album, double durationSec) {
            Intent i = new Intent(MainActivity.this, PlaybackService.class);
            i.setAction(PlaybackService.ACTION_START);
            i.putExtra(PlaybackService.EXTRA_TITLE, title);
            i.putExtra(PlaybackService.EXTRA_ARTIST, artist);
            i.putExtra(PlaybackService.EXTRA_ALBUM, album);
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(i);
            else startService(i);
        }

        @JavascriptInterface
        public void onPaused() {
            Intent i = new Intent(MainActivity.this, PlaybackService.class);
            i.setAction(PlaybackService.ACTION_STOP);
            startService(i);
        }
    }

    // ---------- server picker (reachable from the error screen) ----------

    private void showSetup() {
        webVisible = false;

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#121212"));
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(28), dp(28), dp(28), dp(28));

        TextView logo = new TextView(this);
        logo.setText("W");
        logo.setTextSize(TypedValue.COMPLEX_UNIT_DIP, 64);
        logo.setTypeface(Typeface.DEFAULT_BOLD);
        logo.setTextColor(Color.parseColor("#1db954"));
        logo.setGravity(Gravity.CENTER);
        root.addView(logo);

        TextView title = new TextView(this);
        title.setText("Walkman");
        title.setTextSize(TypedValue.COMPLEX_UNIT_DIP, 30);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextColor(Color.WHITE);
        title.setGravity(Gravity.CENTER);
        root.addView(title);

        TextView sub = new TextView(this);
        sub.setText("Free Hi-Fi music streaming.\nDefault server: " + DEFAULT_SERVER);
        sub.setTextSize(TypedValue.COMPLEX_UNIT_DIP, 14);
        sub.setTextColor(Color.parseColor("#b3b3b3"));
        sub.setGravity(Gravity.CENTER);
        sub.setPadding(0, dp(12), 0, dp(28));
        root.addView(sub);

        final EditText input = new EditText(this);
        input.setHint(DEFAULT_SERVER);
        input.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        input.setImeOptions(EditorInfo.IME_ACTION_DONE);
        input.setTextColor(Color.WHITE);
        input.setHintTextColor(Color.parseColor("#7f7f7f"));
        input.setTextSize(TypedValue.COMPLEX_UNIT_DIP, 15);
        input.setSingleLine(true);
        input.setBackgroundColor(Color.parseColor("#242424"));
        input.setPadding(dp(16), dp(14), dp(16), dp(14));
        root.addView(input);

        final TextView err = new TextView(this);
        err.setTextColor(Color.parseColor("#ed4245"));
        err.setTextSize(TypedValue.COMPLEX_UNIT_DIP, 12);
        err.setPadding(0, dp(8), 0, 0);
        err.setVisibility(View.GONE);
        root.addView(err);

        Button go = new Button(this);
        go.setText("Connect");
        go.setTextColor(Color.BLACK);
        go.setTypeface(Typeface.DEFAULT_BOLD);
        go.setTextSize(TypedValue.COMPLEX_UNIT_DIP, 15);
        go.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#1db954")));
        go.setPadding(dp(24), dp(8), dp(24), dp(8));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(24);
        lp.gravity = Gravity.CENTER_HORIZONTAL;
        go.setLayoutParams(lp);
        root.addView(go);

        View.OnClickListener connect = new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String url = input.getText().toString().trim();
                if (url.length() == 0) {
                    // empty input reconnects to the official server
                    url = DEFAULT_SERVER;
                }
                if (!url.startsWith("http://") && !url.startsWith("https://")) {
                    url = "https://" + url;
                }
                while (url.endsWith("/")) url = url.substring(0, url.length() - 1);
                getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_SERVER, url).apply();
                serverUrl = url;
                openPlayer(url);
            }
        };
        go.setOnClickListener(connect);
        input.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override
            public boolean onEditorAction(TextView tv, int actionId, KeyEvent event) {
                if (actionId == EditorInfo.IME_ACTION_DONE) {
                    connect.onClick(null);
                    return true;
                }
                return false;
            }
        });

        setContentView(root);
    }

    // ---------- WebView player ----------

    private void openPlayer(String base) {
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setVisibility(View.GONE); // shown on first successful page render

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);
        if (android.os.Build.VERSION.SDK_INT >= 21) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        }
        // native playback service bridge (background play with screen off)
        web.addJavascriptInterface(new Bridge(), "WalkmanAndroid");

        final String host = Uri.parse(base).getHost();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri.getHost() == null || uri.getHost().equals(host)) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) { }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                web.setVisibility(View.VISIBLE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    showLoadError(String.valueOf(error.getDescription()));
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        request.grant(request.getResources());
                    }
                });
            }
        });

        web.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                try {
                    DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                    req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    req.setMimeType(mimeType);
                    String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
                    req.setDestinationInExternalPublicDir(Environment.DIRECTORY_MUSIC, name);
                    DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    if (dm != null) dm.enqueue(req);
                    Toast.makeText(MainActivity.this, "Downloading " + name, Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Download failed", Toast.LENGTH_SHORT).show();
                }
            }
        });

        setContentView(web);
        webVisible = true;
        web.loadUrl(base);
    }

    // ---------- native error screen ----------

    private void showLoadError(String message) {
        if (!webVisible) return;
        webVisible = false;

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.parseColor("#121212"));
        root.setPadding(dp(28), dp(28), dp(28), dp(28));

        TextView title = new TextView(this);
        title.setText("Can't reach your Walkman server");
        title.setTextSize(TypedValue.COMPLEX_UNIT_DIP, 20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextColor(Color.WHITE);
        title.setGravity(Gravity.CENTER);
        root.addView(title);

        TextView msg = new TextView(this);
        msg.setText(serverUrl + "\n\n" + message + "\n\nCheck your internet connection, then retry.");
        msg.setTextSize(TypedValue.COMPLEX_UNIT_DIP, 13);
        msg.setTextColor(Color.parseColor("#b3b3b3"));
        msg.setGravity(Gravity.CENTER);
        msg.setPadding(0, dp(16), 0, dp(24));
        root.addView(msg);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER);

        Button retry = new Button(this);
        retry.setText("Retry");
        retry.setTextColor(Color.BLACK);
        retry.setTypeface(Typeface.DEFAULT_BOLD);
        retry.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#1db954")));
        row.addView(retry);

        View spacer = new View(this);
        spacer.setMinimumWidth(dp(16));
        row.addView(spacer);

        Button change = new Button(this);
        change.setText("Change server");
        change.setTextColor(Color.WHITE);
        change.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#333333")));
        row.addView(change);

        root.addView(row);
        setContentView(root);

        retry.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openPlayer(serverUrl);
            }
        });
        change.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showSetup();
            }
        });

        Button reset = new Button(this);
        reset.setText("Use default server");
        reset.setTextColor(Color.WHITE);
        reset.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#2a2a2a")));
        LinearLayout.LayoutParams rlp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        rlp.topMargin = dp(12);
        reset.setLayoutParams(rlp);
        root.addView(reset);
        reset.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                serverUrl = DEFAULT_SERVER;
                getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_SERVER, serverUrl).apply();
                openPlayer(serverUrl);
            }
        });
    }

    // ---------- navigation ----------

    @Override
    public void onBackPressed() {
        if (web != null && webVisible && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        stopService(new Intent(this, PlaybackService.class));
        super.onDestroy();
    }

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }
}
