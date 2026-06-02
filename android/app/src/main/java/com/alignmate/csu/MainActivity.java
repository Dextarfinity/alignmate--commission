package com.alignmate.csu;

import android.Manifest;
import android.content.pm.PackageManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int CAMERA_PERMISSION_REQUEST_CODE = 1001;
    private PermissionRequest pendingWebkitPermissionRequest;

    @Override
    public void onStart() {
        super.onStart();
        setupWebViewCameraPermission();
    }

    private void setupWebViewCameraPermission() {
        WebView webView = getBridge().getWebView();
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                // Check if camera is already granted at the OS level
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                        == PackageManager.PERMISSION_GRANTED) {
                    // Grant all requested resources (camera, audio, etc.)
                    request.grant(request.getResources());
                } else {
                    // Store the pending request and ask the user for OS-level permission
                    pendingWebkitPermissionRequest = request;
                    ActivityCompat.requestPermissions(
                            MainActivity.this,
                            new String[]{Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO},
                            CAMERA_PERMISSION_REQUEST_CODE
                    );
                }
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE) {
            if (pendingWebkitPermissionRequest != null) {
                if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    pendingWebkitPermissionRequest.grant(pendingWebkitPermissionRequest.getResources());
                } else {
                    pendingWebkitPermissionRequest.deny();
                }
                pendingWebkitPermissionRequest = null;
            }
        }
    }
}
