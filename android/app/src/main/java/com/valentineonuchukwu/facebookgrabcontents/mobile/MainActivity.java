package com.valentineonuchukwu.facebookgrabcontents.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.text.InputType;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

/**
 * FacebookGrabContents Mobile.
 *
 * The desktop app (Windows/macOS/Linux) runs the real engine: yt-dlp,
 * ffmpeg, the tamper-evident vault and the AI. This shell simply pairs with
 * that engine over the local Wi-Fi and presents the same UI in a WebView, so
 * Android users get everything the desktop users get — same URL, same
 * origin, zero API changes.
 *
 * First launch: a dark pairing screen asks for the PC address shown in
 * Desktop → Phone Connect (e.g. "192.168.1.5:3000"). After that the address
 * is remembered and the app opens the engine UI directly.
 */
public class MainActivity extends Activity {

    private static final String PREFS = "fgc_mobile";
    private static final String KEY_ADDRESS = "engine_address";

    private static final int BRAND_BG = 0xFF0B1020;
    private static final int BRAND_TEXT = 0xFFF1F5F9;
    private static final int BRAND_HINT = 0xFF94A3B8;
    private static final int BRAND_BOX = 0xFF111A2E;
    private static final int BRAND_ACCENT = 0xFF4338CA;

    private SharedPreferences prefs;
    private String address = "";
    private WebView webView;
    private View connectView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        address = prefs.getString(KEY_ADDRESS, "");
        getWindow().getDecorView().setBackgroundColor(BRAND_BG);
        if (address.isEmpty()) {
            showConnectScreen();
        } else {
            showEngine(address);
        }
    }

    // ------------------------------------------------------------------
    // Pairing screen
    // ------------------------------------------------------------------

    private void showConnectScreen() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setPadding(dp(28), dp(28), dp(28), dp(28));
        root.setBackgroundColor(BRAND_BG);

        TextView title = new TextView(this);
        title.setText("FacebookGrabContents");
        title.setTextColor(BRAND_TEXT);
        title.setTextSize(22);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, dp(64), 0, dp(6));
        root.addView(title);

        TextView sub = new TextView(this);
        sub.setText("\uD83D\uDCF1 ProsperChild Technology");
        sub.setTextColor(BRAND_HINT);
        sub.setTextSize(12);
        sub.setGravity(Gravity.CENTER);
        sub.setPadding(0, 0, 0, dp(28));
        root.addView(sub);

        TextView label = new TextView(this);
        label.setText("Connect to your computer\n(Desktop \u2192 Phone Connect)");
        label.setTextColor(BRAND_HINT);
        label.setTextSize(14);
        label.setGravity(Gravity.CENTER);
        label.setLineSpacing(dp(3), 1);
        label.setPadding(0, 0, 0, dp(14));
        root.addView(label);

        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        input.setHint("192.168.1.5:3000");
        input.setTextColor(BRAND_TEXT);
        input.setHintTextColor(0xFF475569);
        input.setTextSize(15);
        input.setSingleLine(true);
        input.setImeOptions(EditorInfo.IME_ACTION_DONE);
        styledBackground(input, BRAND_BOX, dp(12));
        input.setPadding(dp(14), dp(12), dp(14), dp(12));
        root.addView(input, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        Button connect = new Button(this);
        connect.setText("Connect");
        connect.setTextColor(Color.WHITE);
        connect.setTextSize(14);
        styledBackground(connect, BRAND_ACCENT, dp(12));
        connect.setOnClickListener(v -> tryConnect(input));
        LinearLayout.LayoutParams btnLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        btnLp.topMargin = dp(14);
        root.addView(connect, btnLp);

        TextView help = new TextView(this);
        help.setText("1. Open FacebookGrabContents on your PC and turn on Phone Connect in the Desktop panel.\n\n"
                + "2. Type the address from the panel — e.g. 192.168.1.5:3000\n\n"
                + "3. Both devices must be on the same Wi-Fi. Downloads land in the Downloads folder of your phone.");
        help.setTextColor(BRAND_HINT);
        help.setTextSize(12);
        help.setLineSpacing(dp(3), 1);
        help.setGravity(Gravity.START);
        help.setPadding(0, dp(28), 0, 0);
        root.addView(help);

        connectView = root;
        setContentView(root);
        input.requestFocus();

        input.setOnEditorActionListener((v, actionId, event) -> {
            tryConnect(input);
            return true;
        });
    }

    private void styledBackground(View view, int color, float radius) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(radius);
        view.setBackground(d);
    }

    /** "192.168.1.5:3000" → "http://192.168.1.5:3000" (scheme optional). */
    private String normalize(String raw) {
        String trimmed = raw == null ? "" : raw.trim();
        if (trimmed.isEmpty()) return "";
        if (!trimmed.matches("(?i)^[a-z][a-z0-9+.-]*://.*")) trimmed = "http://" + trimmed;
        return trimmed.replaceAll("/+$", "");
    }

    private void tryConnect(EditText input) {
        String target = normalize(input != null ? input.getText().toString() : "");
        // host(:port) — port required in practice, since the engine never
        // serves port 80. IPv4, hostname and [IPv6] literals are all accepted.
        if (!target.matches("(?i)^https?://[a-z0-9.\\-]+(:\\d{2,5})/?$")) {
            toast("Enter the address exactly as shown in the Desktop panel, e.g. 192.168.1.5:3000");
            return;
        }
        prefs.edit().putString(KEY_ADDRESS, target).apply();
        address = target;
        if (connectView != null) connectView.setVisibility(View.GONE);
        showEngine(target);
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    // ------------------------------------------------------------------
    // Engine UI (WebView)
    // ------------------------------------------------------------------

    @SuppressLint("SetJavaScriptEnabled")
    private void showEngine(String engineUrl) {
        webView = new WebView(this);
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setLoadWithOverviewMode(true);
        ws.setUseWideViewPort(true);
        ws.setSupportZoom(false);
        webView.setBackgroundColor(BRAND_BG);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String target) {
                if (target.startsWith(address)) return true; // handled by WebView itself
                if (sameOrigin(target, address)) return false; // engine pages stay inside the app
                openExternally(target);
                return true;
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                // Only a main-frame failure kills the session; sub-resource
                // hiccups degrade quietly.
                String main = view.getUrl();
                if (main != null && failingUrl != null && sameOrigin(failingUrl, main)) {
                    showUnreachable(failingUrl);
                }
            }
        });

        // Engine download endpoints (videos, merged clips) hand the bytes to
        // Android's DownloadManager — they appear in the system Downloads
        // list with a notification, like any browser download.
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                String cookie = CookieManager.getInstance().getCookie(address);
                if (cookie != null) req.addRequestHeader("Cookie", cookie);
                if (userAgent != null) req.addRequestHeader("User-Agent", userAgent);
                req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,
                        URLUtil.guessFileName(url, contentDisposition, mimeType));
                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) dm.enqueue(req);
                toast("Downloading\u2026");
            } catch (Exception e) {
                toast("Download failed: " + e.getMessage());
            }
        });

        setContentView(webView);
        webView.loadUrl(engineUrl);
    }

    private boolean sameOrigin(String a, String b) {
        try {
            return Uri.parse(a).getAuthority() != null
                    && Uri.parse(a).getAuthority().equals(Uri.parse(b).getAuthority());
        } catch (Exception e) {
            return false;
        }
    }

    private void showUnreachable(String failingUrl) {
        runOnUiThread(() -> new AlertDialog.Builder(this)
                .setTitle("Can't reach your computer")
                .setMessage("FacebookGrabContents is not answering.\n\n"
                        + "\u2022 Make sure the desktop app is running with Phone Connect on\n"
                        + "\u2022 Phone and PC must share the same Wi-Fi\n"
                        + "\u2022 If your PC's address changed, reconnect with the new one")
                .setPositiveButton("Reconnect", (d, w) -> {
                    prefs.edit().remove(KEY_ADDRESS).apply();
                    address = "";
                    if (webView != null) webView.destroy();
                    webView = null;
                    showConnectScreen();
                })
                .setNegativeButton("Retry", (d, w) -> {
                    if (webView != null) webView.reload();
                })
                .setOnCancelListener(d -> {
                    // Never leave the user stranded on a dead web view.
                    prefs.edit().remove(KEY_ADDRESS).apply();
                    address = "";
                    if (webView != null) webView.destroy();
                    webView = null;
                    showConnectScreen();
                })
                .show());
    }

    private void openExternally(String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            toast("No browser available to open this link");
        }
    }

    // ------------------------------------------------------------------
    // Navigation
    // ------------------------------------------------------------------

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView != null && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
