#include "DHTesp.h"

const int DHT_PIN = 15;

DHTesp dht;

void setup()
{
  Serial.begin(115200);
  dht.setup(DHT_PIN, DHTesp::DHT22);

  Serial.println("PharmaTrace-ES IoT Simulation Started");
}

void loop()
{
  delay(2000);

  TempAndHumidity data = dht.getTempAndHumidity();

  Serial.print("Temperature: ");
  Serial.print(data.temperature, 2);
  Serial.println(" °C");

  Serial.print("Humidity: ");
  Serial.print(data.humidity, 2);
  Serial.println(" %");
}