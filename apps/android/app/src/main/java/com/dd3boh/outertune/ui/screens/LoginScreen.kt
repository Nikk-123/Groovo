package com.dd3boh.outertune.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.filled.Face
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.dd3boh.outertune.LocalPlayerAwareWindowInsets
import com.dd3boh.outertune.R
import com.dd3boh.outertune.constants.AccountEmailKey
import com.dd3boh.outertune.ui.utils.backToMain
import com.dd3boh.outertune.ui.viewmodels.AuthEvent
import com.dd3boh.outertune.ui.viewmodels.AuthUiState
import com.dd3boh.outertune.ui.viewmodels.AuthViewModel
import com.dd3boh.outertune.utils.rememberPreference

// Groovo Colors
private val GroovoGreen = Color(0xFF1DB954)
private val GroovoBlack = Color(0xFF000000)
private val GroovoDarkGray = Color(0xFF121212)
private val GroovoInputGray = Color(0xFF282828)
private val GroovoTextGray = Color(0xFFB3B3B3)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    navController: NavController,
    viewModel: AuthViewModel = hiltViewModel()
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isSignup by remember { mutableStateOf(false) }

    val uiState by viewModel.loginState.collectAsState()
    var accountEmail by rememberPreference(AccountEmailKey, "")

    LaunchedEffect(viewModel.authEvent) {
        viewModel.authEvent.collect { event ->
            when (event) {
                is AuthEvent.NavigateToHome -> {
                    accountEmail = email
                    navController.backToMain()
                }
            }
        }
    }

    Scaffold(
        containerColor = Color.Transparent, // Transparent to show gradient
        contentWindowInsets = LocalPlayerAwareWindowInsets.current,
        topBar = {
             // Minimal transparent top bar just for back navigation
             TopAppBar(
                 title = {},
                 navigationIcon = {
                     IconButton(onClick = navController::navigateUp) {
                         Icon(
                             Icons.AutoMirrored.Rounded.ArrowBack,
                             contentDescription = null,
                             tint = Color.White
                         )
                     }
                 },
                 colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
             )
        }
    ) { paddingValues ->
        // Gradient Background
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(GroovoGreen.copy(alpha = 0.8f), GroovoBlack.copy(alpha = 0.95f), GroovoBlack)
                    )
                )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .verticalScroll(rememberScrollState())
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                // Logo Area
                Image(
                    painter = painterResource(id = R.drawable.logo),
                    contentDescription = "Groovo Logo",
                    modifier = Modifier.size(64.dp),
                    contentScale = ContentScale.Fit
                )
                Text(
                    text = "GROOVO",
                    color = Color.White,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 8.dp, bottom = 32.dp)
                )

                // Login Card
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(GroovoBlack)
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = if (isSignup) "Sign up for free" else "Log in to continue",
                        color = Color.White,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 24.dp)
                    )

                    when (val state = uiState) {
                        is AuthUiState.Loading -> {
                            CircularProgressIndicator(color = GroovoGreen)
                        }
                        else -> {
                            if (state is AuthUiState.Error) {
                                Text(
                                    text = state.message,
                                    color = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.padding(bottom = 16.dp)
                                )
                            }

                            // Email Input
                            Column(modifier = Modifier.fillMaxWidth()) {
                                Text(
                                    text = if (isSignup) "What's your email?" else "Email address",
                                    color = Color.White,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(bottom = 8.dp)
                                )
                                OutlinedTextField(
                                    value = email,
                                    onValueChange = { email = it },
                                    placeholder = { Text("Enter your email", color = Color.Gray) },
                                    modifier = Modifier.fillMaxWidth(),
//                                    colors = OutlinedTextFieldDefaults.colors(
//                                        focusedContainerColor = GroovoInputGray,
//                                        unfocusedContainerColor = GroovoInputGray,
//                                        focusedBorderColor = GroovoGreen,
//                                        unfocusedBorderColor = Color.Transparent,
//                                        cursorColor = GroovoGreen,
//                                        focusedTextColor = Color.White,
//                                        unfocusedTextColor = Color.White
//                                    ),
                                    shape = RoundedCornerShape(4.dp),
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                                    singleLine = true
                                )
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            // Password Input
                            Column(modifier = Modifier.fillMaxWidth()) {
                                Text(
                                    text = if (isSignup) "Create a password" else "Password",
                                    color = Color.White,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(bottom = 8.dp)
                                )
                                OutlinedTextField(
                                    value = password,
                                    onValueChange = { password = it },
                                    placeholder = { Text("Password", color = Color.Gray) },
                                    modifier = Modifier.fillMaxWidth(),
//                                    colors = OutlinedTextFieldDefaults.colors(
//                                        focusedContainerColor = GroovoInputGray,
//                                        unfocusedContainerColor = GroovoInputGray,
//                                        focusedBorderColor = GroovoGreen,
//                                        unfocusedBorderColor = Color.Transparent,
//                                        cursorColor = GroovoGreen,
//                                        focusedTextColor = Color.White,
//                                        unfocusedTextColor = Color.White
//                                    ),
                                    shape = RoundedCornerShape(4.dp),
                                    visualTransformation = PasswordVisualTransformation(),
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                                    singleLine = true
                                )
                            }

                            Spacer(modifier = Modifier.height(32.dp))

                            // Action Button
                            Button(
                                onClick = {
                                    if (isSignup) {
                                        viewModel.signup(email, password)
                                    } else {
                                        viewModel.login(email, password)
                                    }
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(48.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = GroovoGreen),
                                shape = CircleShape
                            ) {
                                Text(
                                    text = if (isSignup) "SIGN UP" else "LOG IN",
                                    color = GroovoBlack,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp
                                )
                            }

                            if (!isSignup) {
                                Spacer(modifier = Modifier.height(24.dp))

                                // Divider
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    HorizontalDivider(modifier = Modifier.weight(1f), color = GroovoInputGray)
                                    Text(
                                        text = "or",
                                        color = GroovoTextGray,
                                        modifier = Modifier.padding(horizontal = 8.dp),
                                        fontSize = 12.sp
                                    )
                                    HorizontalDivider(modifier = Modifier.weight(1f), color = GroovoInputGray)
                                }

                                Spacer(modifier = Modifier.height(24.dp))

                                // Face ID Button (Visual only for now)
                                Button(
                                    onClick = { /* TODO: Implement Face ID logic */ },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(48.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = GroovoInputGray),
                                    shape = CircleShape
                                ) {
                                    Icon(Icons.Filled.Face, contentDescription = null, tint = Color.White)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "Face ID",
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(24.dp))
                            HorizontalDivider(color = GroovoInputGray)
                            Spacer(modifier = Modifier.height(24.dp))

                            // Toggle Mode
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = if (isSignup) "Already have an account?" else "Don't have an account?",
                                    color = GroovoTextGray,
                                    fontSize = 14.sp
                                )
                                TextButton(onClick = {
                                    isSignup = !isSignup
                                    viewModel.resetState()
                                }) {
                                    Text(
                                        text = if (isSignup) "LOG IN TO GROOVO" else "SIGN UP FOR GROOVO",
                                        color = GroovoGreen,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

