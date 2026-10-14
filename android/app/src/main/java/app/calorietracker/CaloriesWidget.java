package app.calorietracker;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * 🥗 Home-screen widget: calories left today and water. The app sends the numbers (WidgetPlugin) each time
 * something changes; on a new day (before the app is opened) it shows the full goal again. Tap = open the app.
 */
public class CaloriesWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) mgr.updateAppWidget(id, views(ctx));
    }

    static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, CaloriesWidget.class));
        for (int id : ids) mgr.updateAppWidget(id, views(ctx));
    }

    static RemoteViews views(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(WidgetPlugin.PREFS, Context.MODE_PRIVATE);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        boolean fresh = today.equals(p.getString("date", ""));
        boolean any = !p.getString("big", "").isEmpty();
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_calories);
        if (!any) {
            v.setTextViewText(R.id.w_big, "–");
            v.setTextViewText(R.id.w_label, "Open the app once");
            v.setTextViewText(R.id.w_sub, "to show your calories here");
            v.setTextViewText(R.id.w_water, "");
            v.setProgressBar(R.id.w_bar, 100, 0, false);
        } else if (fresh) {
            v.setTextViewText(R.id.w_big, p.getString("big", ""));
            v.setTextViewText(R.id.w_label, p.getString("label", ""));
            v.setTextViewText(R.id.w_sub, p.getString("sub", ""));
            v.setTextViewText(R.id.w_water, p.getString("water", ""));
            v.setProgressBar(R.id.w_bar, 100, Math.max(0, Math.min(100, p.getInt("pct", 0))), false);
            v.setTextColor(R.id.w_big, p.getBoolean("over", false) ? 0xFFF87171 : 0xFFFFFFFF);
        } else {
            v.setTextViewText(R.id.w_big, p.getString("newBig", ""));
            v.setTextViewText(R.id.w_label, "left · new day");
            v.setTextViewText(R.id.w_sub, p.getString("newSub", ""));
            v.setTextViewText(R.id.w_water, p.getString("newWater", ""));
            v.setProgressBar(R.id.w_bar, 100, 0, false);
            v.setTextColor(R.id.w_big, 0xFFFFFFFF);
        }
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_root, pi);
        return v;
    }
}
