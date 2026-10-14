package app.calorietracker;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The home-screen widget's bridge: the app sends it today's numbers.
        registerPlugin(WidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
