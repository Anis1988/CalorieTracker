package app.calorietracker;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The home-screen widget's bridge: the app sends it today's numbers.
        registerPlugin(WidgetPlugin.class);
        // ⬆️ The update banner's Update button: downloads the new app and opens Android's installer.
        registerPlugin(UpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
