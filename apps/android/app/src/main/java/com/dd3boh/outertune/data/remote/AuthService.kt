package com.dd3boh.outertune.data.remote

import com.dd3boh.outertune.models.AuthResponse
import com.dd3boh.outertune.models.LoginRequest
import com.dd3boh.outertune.models.SignupRequest
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthService @Inject constructor() {
    private val client = HttpClient(OkHttp) {
        install(io.ktor.client.plugins.HttpTimeout) {
            requestTimeoutMillis = 120000
            connectTimeoutMillis = 120000
            socketTimeoutMillis = 120000
        }
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
                encodeDefaults = true
            })
        }
        defaultRequest {
            url("https://login-auth-jgxb.onrender.com/")
            contentType(ContentType.Application.Json)
        }
    }

    suspend fun login(request: LoginRequest): AuthResponse {
        return client.post("api/login") {
            setBody(request)
        }.body()
    }

    suspend fun signup(request: SignupRequest): AuthResponse {
        return client.post("api/signup") {
            setBody(request)
        }.body()
    }

    suspend fun checkSession(email: String): AuthResponse {
        return client.get("api/check-session") {
            header("X-User-Email", email)
        }.body()
    }
}
