package com.walkman.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

/**
 * Foreground service that keeps Walkman's audio alive while the screen is off
 * or the app is in the background, and surfaces a media notification with the
 * current track. Started/stopped from the web app through the WalkmanAndroid
 * JavascriptInterface bridge (onPlaying / onPaused).
 */
public class PlaybackService extends Service {

    private static final String CHANNEL_ID = "walkman_playback";
    private static final int NOTIFICATION_ID = 42;
    public static final String ACTION_START = "com.walkman.app.START";
    public static final String ACTION_STOP = "com.walkman.app.STOP";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ALBUM = "album";

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_STOP;
        if (ACTION_STOP.equals(action)) {
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        String title = intent.getStringExtra(EXTRA_TITLE);
        String artist = intent.getStringExtra(EXTRA_ARTIST);
        String album = intent.getStringExtra(EXTRA_ALBUM);
        startForeground(NOTIFICATION_ID, buildNotification(title, artist, album));
        return START_STICKY;
    }

    private Notification buildNotification(String title, String artist, String album) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Playback",
                    NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Keeps Walkman playing in the background");
            ch.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        b.setContentTitle(title != null && title.length() > 0 ? title : "Walkman")
                .setContentText(artist != null && artist.length() > 0 ? artist : "Free Hi-Fi music streaming")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setOngoing(true)
                .setContentIntent(contentIntent());
        if (album != null && album.length() > 0) b.setSubText(album);
        return b.build();
    }

    private PendingIntent contentIntent() {
        Intent i = new Intent(this, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, 0, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
