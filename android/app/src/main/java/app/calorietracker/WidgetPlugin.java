package app.calorietracker;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Receives today's numbers from the app (already in words, in your units) and refreshes the home-screen widget. */
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {
    static final String PREFS = "ct_widget";
    static final String[] KEYS = { "date", "big", "label", "sub", "water", "newBig", "newSub", "newWater" };

    @PluginMethod
    public void update(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences.Editor e = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        for (String k : KEYS) e.putString(k, call.getString(k, ""));
        e.putInt("pct", call.getInt("pct", 0));
        e.putBoolean("over", call.getBoolean("over", false));
        e.apply();
        CaloriesWidget.updateAll(ctx);
        call.resolve();
    }
}
