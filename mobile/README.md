# IT Asset Manager — Mobile (Flutter)

Field companion for the IT Asset & Custody Management System.

- Secure login (JWT stored with `flutter_secure_storage`)
- Camera QR scanner (`mobile_scanner`) → asset details (warranty, purchase date, current holder, history)
- Field operations: Handover to staff · Receive asset back · Report fault
- "My Assets" personal custody screen and profile

```bash
flutter pub get
flutter run                                                    # Android emulator → http://10.0.2.2:4000/api
flutter run --dart-define=API_URL=http://<PC-LAN-IP>:4000/api  # physical device
flutter build apk --release --dart-define=API_URL=https://your-server/api
```

See the root [README](../README.md) for backend setup and demo accounts.
