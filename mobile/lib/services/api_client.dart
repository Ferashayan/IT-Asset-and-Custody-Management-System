import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../config.dart';

class ApiException implements Exception {
  final String message;
  final int statusCode;
  ApiException(this.message, this.statusCode);

  bool get isUnauthorized => statusCode == 401;

  @override
  String toString() => message;
}

/// Thin HTTP client for the backend's `{ success, message, data, error }` envelope.
/// The JWT is kept in the platform keystore via flutter_secure_storage.
class ApiClient {
  static const _tokenKey = 'itam_jwt';
  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  final http.Client _http = http.Client();
  String? _token;

  /// Invoked when the server rejects the token (expired / revoked).
  void Function()? onUnauthorized;

  Future<String?> loadToken() async => _token = await _storage.read(key: _tokenKey);

  Future<void> saveToken(String token) async {
    _token = token;
    await _storage.write(key: _tokenKey, value: token);
  }

  Future<void> clearToken() async {
    _token = null;
    await _storage.delete(key: _tokenKey);
  }

  Future<dynamic> get(String path) => _send('GET', path);
  Future<dynamic> post(String path, [Map<String, dynamic>? body]) => _send('POST', path, body ?? {});

  Future<dynamic> _send(String method, String path, [Map<String, dynamic>? body]) async {
    final uri = Uri.parse('$apiBaseUrl$path');
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (_token != null) 'Authorization': 'Bearer $_token',
    };

    http.Response res;
    try {
      final request = http.Request(method, uri)..headers.addAll(headers);
      if (body != null) request.body = jsonEncode(body);
      res = await http.Response.fromStream(await _http.send(request).timeout(const Duration(seconds: 15)));
    } on SocketException {
      throw ApiException('Cannot reach the server ($apiBaseUrl)', 0);
    } on TimeoutException {
      throw ApiException('The server took too long to respond', 0);
    }

    Map<String, dynamic>? payload;
    try {
      payload = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
    } catch (_) {
      payload = null;
    }

    if (res.statusCode >= 400 || payload?['success'] != true) {
      if (res.statusCode == 401 && _token != null && path != '/auth/login') {
        onUnauthorized?.call();
      }
      throw ApiException(payload?['message'] as String? ?? 'Request failed (${res.statusCode})', res.statusCode);
    }
    return payload!['data'];
  }
}
