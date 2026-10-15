import 'package:flutter/foundation.dart';

import '../models/models.dart';
import 'api_client.dart';

class AuthService extends ChangeNotifier {
  final ApiClient api;
  AppUser? user;
  bool restoring = true;

  AuthService(this.api) {
    api.onUnauthorized = () {
      api.clearToken();
      user = null;
      notifyListeners();
    };
  }

  bool get isLoggedIn => user != null;

  /// Restore the session from the secure keystore on app start.
  Future<void> restore() async {
    try {
      if (await api.loadToken() != null) {
        user = AppUser.fromJson(await api.get('/auth/me') as Map<String, dynamic>);
      }
    } catch (_) {
      await api.clearToken();
      user = null;
    } finally {
      restoring = false;
      notifyListeners();
    }
  }

  Future<void> login(String username, String password) async {
    final data = await api.post('/auth/login', {'username': username, 'password': password}) as Map<String, dynamic>;
    await api.saveToken(data['token'] as String);
    user = AppUser.fromJson(data['user'] as Map<String, dynamic>);
    notifyListeners();
  }

  Future<void> logout() async {
    try {
      await api.post('/auth/logout');
    } catch (_) {
      // ignore - we log out locally regardless
    }
    await api.clearToken();
    user = null;
    notifyListeners();
  }
}
