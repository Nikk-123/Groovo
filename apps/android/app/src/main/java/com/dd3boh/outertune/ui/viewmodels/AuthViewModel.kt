package com.dd3boh.outertune.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dd3boh.outertune.data.repository.AuthRepository
import com.dd3boh.outertune.data.repository.Result
import com.dd3boh.outertune.models.AuthResponse
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _loginState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val loginState = _loginState.asStateFlow()

    private val _authEvent = Channel<AuthEvent>()
    val authEvent = _authEvent.receiveAsFlow()

    fun login(email: String, password: String) {
        viewModelScope.launch {
            authRepository.login(email, password).collect { result ->
                when (result) {
                    is Result.Loading -> _loginState.value = AuthUiState.Loading
                    is Result.Success -> {
                        _loginState.value = AuthUiState.Success(result.data)
                        _authEvent.send(AuthEvent.NavigateToHome)
                    }
                    is Result.Error -> {
                        _loginState.value = AuthUiState.Error(result.message)
                    }
                }
            }
        }
    }

    fun signup(email: String, password: String) {
        viewModelScope.launch {
             authRepository.signup(email, password).collect { result ->
                when (result) {
                    is Result.Loading -> _loginState.value = AuthUiState.Loading
                    is Result.Success -> {
                        _loginState.value = AuthUiState.Success(result.data)
                        // Should we auto-login or ask user to login?
                        // For now, let's treat signup success as login success
                         _authEvent.send(AuthEvent.NavigateToHome)
                    }
                    is Result.Error -> {
                        _loginState.value = AuthUiState.Error(result.message)
                    }
                }
            }
        }
    }
    
    fun resetState() {
        _loginState.value = AuthUiState.Idle
    }
}

sealed class AuthUiState {
    object Idle : AuthUiState()
    object Loading : AuthUiState()
    data class Success(val response: AuthResponse) : AuthUiState()
    data class Error(val message: String) : AuthUiState()
}

sealed class AuthEvent {
    object NavigateToHome : AuthEvent()
}
