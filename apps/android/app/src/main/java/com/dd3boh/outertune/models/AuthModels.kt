package com.dd3boh.outertune.models

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val email: String,
    val password: String? = null,
    val auto_login: Boolean = false
)

@Serializable
data class SignupRequest(
    val email: String,
    val password: String
)

@Serializable
data class AuthResponse(
    val success: Boolean,
    val message: String,
    val user: UserDto? = null,
    val library: List<SongDto>? = null
)

@Serializable
data class UserDto(
    val email: String
)

@Serializable
data class SongDto(
    val title: String,
    val url: String,
    val thumbnail: String? = null,
    val artist: String? = null,
    val duration: String? = null
)
