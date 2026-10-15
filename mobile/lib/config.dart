/// API base URL. Override at build/run time:
///   flutter run --dart-define=API_URL=http://192.168.1.50:4000/api
///
/// The default (10.0.2.2) is how the Android emulator reaches the host machine.
const String apiBaseUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://10.0.2.2:4000/api',
);
